import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  ACESFilmicToneMapping,
  Euler,
  Frustum,
  Matrix4,
  Quaternion,
  Sphere,
  SRGBColorSpace,
  Vector3,
} from 'three'
import {
  describeShipAppearance,
  type FlightState,
} from '../domain/flight'
import { STAR_RADIUS, type CelestialBodyKey } from '../domain/celestial-interaction'
import {
  planetPositionAt,
  type GitHubSystem,
} from '../domain/github-system'
import type { SystemOrbitalVisual } from '../domain/orbital-generation'
import type { VisualSettings } from '../platform/visual-settings'
import { turboVisualProfile } from '../domain/turbo-visual'
import { OrbitingPlanet } from './scene/ProceduralPlanet'
import { ProceduralShip, SHIP_WORLD_SCALE } from './scene/ProceduralShip'
import { ProceduralCockpit } from './scene/ProceduralCockpit'
import { ProceduralStar } from './scene/ProceduralStar'
import { OrbitalRockEnvironment } from './scene/OrbitalDetails'
import { SpaceBackground } from './scene/SpaceBackground'
import { hsl } from './scene/visual-utils'

export type CelestialMarkerStatus = 'visible' | 'offscreen' | 'behind'
export type CameraMode = 'first-person' | 'third-person'

interface Point2D {
  x: number
  y: number
}

export interface CelestialMarkerState {
  key: CelestialBodyKey
  label: string
  status: CelestialMarkerStatus
  screenPosition: Point2D
  direction?: Point2D
}

// Keep label discovery independent from interaction zones while offering roughly
// twice the previous surface clearance.
const PLANET_MARKER_DISCOVERY_CLEARANCE = 36
// Scale the chase rig with the ship so its screen-space composition stays unchanged.
const SHIP_CAMERA_COMPOSITION_SCALE = SHIP_WORLD_SCALE / 0.06
const CHASE_CAMERA_BACK_DISTANCE = 0.85 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_HEIGHT = 0.22 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_LOOK_DISTANCE = 7 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_LOOK_HEIGHT = 0.05 * SHIP_CAMERA_COMPOSITION_SCALE
const COCKPIT_CAMERA_HEIGHT = 0.028
const COCKPIT_CAMERA_FORWARD = 0.045
const FIRST_PERSON_ATTITUDE_SCALE = 0.3
const CAMERA_TRANSITION_MILLISECONDS = 400
const CAMERA_TRANSITION_CLEARANCE = 0.05

function planetMarkerDiscoveryRadius(planetRadius: number): number {
  return planetRadius + PLANET_MARKER_DISCOVERY_CLEARANCE
}

type FlightStateRef = RefObject<FlightState>

function FlightSimulation({
  advanceFlightFrame,
}: {
  advanceFlightFrame: (time: number) => void
}) {
  useFrame(() => advanceFlightFrame(performance.now()), -100)
  return null
}

function FlightCamera({
  flightRef,
  mode,
  transitionRequested,
  onTransitionComplete,
}: {
  flightRef: FlightStateRef
  mode: CameraMode
  transitionRequested: boolean
  onTransitionComplete: () => void
}) {
  const { camera } = useThree()
  const desiredPosition = useRef(new Vector3())
  const lookAt = useRef(new Vector3())
  const shipPosition = useRef(new Vector3())
  const forward = useRef(new Vector3())
  const up = useRef(new Vector3())
  const targetQuaternion = useRef(new Quaternion())
  const attitudeEuler = useRef(new Euler())
  const attitudeQuaternion = useRef(new Quaternion())
  const lookMatrix = useRef(new Matrix4())
  const cameraPitch = useRef(0)
  const transition = useRef<{
    startedAt: number
    position: Vector3
    quaternion: Quaternion
  } | null>(null)

  useEffect(() => {
    if (!transitionRequested) return
    transition.current = {
      startedAt: performance.now(),
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
    }
  }, [camera, mode, transitionRequested])

  useFrame((_, elapsedSeconds) => {
    const flight = flightRef.current
    const frameSeconds = Math.min(elapsedSeconds, 0.05)
    const targetPitch = flight.pitch * 0.45
    cameraPitch.current +=
      (targetPitch - cameraPitch.current) * (1 - Math.exp(-4 * frameSeconds))

    if (mode === 'first-person') {
      attitudeEuler.current.set(
        flight.pitch * FIRST_PERSON_ATTITUDE_SCALE,
        flight.heading,
        flight.bank * FIRST_PERSON_ATTITUDE_SCALE,
        'YXZ',
      )
      attitudeQuaternion.current.setFromEuler(attitudeEuler.current)
      forward.current.set(0, 0, 1).applyQuaternion(attitudeQuaternion.current)
      up.current.set(0, 1, 0).applyQuaternion(attitudeQuaternion.current)
      shipPosition.current.set(flight.x, flight.altitude, flight.z)
      desiredPosition.current
        .set(0, COCKPIT_CAMERA_HEIGHT, COCKPIT_CAMERA_FORWARD)
        .applyQuaternion(attitudeQuaternion.current)
        .add(shipPosition.current)
      lookAt.current.copy(desiredPosition.current).add(forward.current)
    } else {
      const horizontalForward = Math.cos(cameraPitch.current)
      forward.current.set(
        Math.sin(flight.heading) * horizontalForward,
        -Math.sin(cameraPitch.current),
        Math.cos(flight.heading) * horizontalForward,
      )
      up.current.set(0, 1, 0)
      desiredPosition.current.set(
        flight.x - forward.current.x * CHASE_CAMERA_BACK_DISTANCE,
        flight.altitude + CHASE_CAMERA_HEIGHT - forward.current.y * CHASE_CAMERA_BACK_DISTANCE,
        flight.z - forward.current.z * CHASE_CAMERA_BACK_DISTANCE,
      )
      lookAt.current.set(
        flight.x + forward.current.x * CHASE_CAMERA_LOOK_DISTANCE,
        flight.altitude + CHASE_CAMERA_LOOK_HEIGHT + forward.current.y * CHASE_CAMERA_LOOK_DISTANCE,
        flight.z + forward.current.z * CHASE_CAMERA_LOOK_DISTANCE,
      )
    }
    lookMatrix.current.lookAt(desiredPosition.current, lookAt.current, up.current)
    targetQuaternion.current.setFromRotationMatrix(lookMatrix.current)

    const activeTransition = transition.current
    if (activeTransition) {
      const progress = Math.min(
        1,
        (performance.now() - activeTransition.startedAt) / CAMERA_TRANSITION_MILLISECONDS,
      )
      const eased = progress * progress * (3 - 2 * progress)
      camera.position.lerpVectors(activeTransition.position, desiredPosition.current, eased)
      camera.position.set(
        camera.position.x,
        camera.position.y + Math.sin(Math.PI * eased) * CAMERA_TRANSITION_CLEARANCE,
        camera.position.z,
      )
      camera.quaternion.copy(activeTransition.quaternion).slerp(targetQuaternion.current, eased)
      if (progress >= 1) {
        transition.current = null
        onTransitionComplete()
      }
      return
    }

    if (mode === 'third-person') {
      camera.position.lerp(desiredPosition.current, 1 - Math.exp(-7 * frameSeconds))
      camera.quaternion.slerp(targetQuaternion.current, 1 - Math.exp(-10 * frameSeconds))
    } else {
      camera.position.copy(desiredPosition.current)
      camera.quaternion.copy(targetQuaternion.current)
    }
  }, -40)

  return null
}

function OrientationTracker({
  system,
  flightRef,
  simulationElapsedSeconds,
  onMarkersChange,
}: {
  system: GitHubSystem
  flightRef: FlightStateRef
  simulationElapsedSeconds: RefObject<number>
  onMarkersChange: (markers: CelestialMarkerState[]) => void
}) {
  const { camera } = useThree()
  const cameraSpacePosition = useRef(new Vector3())
  const projectedPosition = useRef(new Vector3())
  const projectionScreenMatrix = useRef(new Matrix4())
  const viewFrustum = useRef(new Frustum())
  const bodySphere = useRef(new Sphere())

  useFrame(() => {
    const flight = flightRef.current
    camera.updateMatrixWorld()
    projectionScreenMatrix.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    viewFrustum.current.setFromProjectionMatrix(projectionScreenMatrix.current)
    const elapsedSeconds = simulationElapsedSeconds.current
    const nearbyPlanets = system.planets.flatMap((planet) => {
      const position = planetPositionAt(planet, elapsedSeconds)
      const distanceFromShip = Math.hypot(
        flight.x - position.x,
        flight.altitude - position.y,
        flight.z - position.z,
      )
      if (distanceFromShip > planetMarkerDiscoveryRadius(planet.radius)) return []

      return [{
        key: `planet:${planet.repository.id}` as const,
        label: planet.repository.name,
        position: new Vector3(position.x, position.y, position.z),
        radius: planet.radius,
      }]
    })
    const bodies = [
      {
        key: 'star' as const,
        label: `Estrella de ${system.profile.login}`,
        position: new Vector3(),
        radius: STAR_RADIUS,
      },
      ...nearbyPlanets,
    ]

    onMarkersChange(
      bodies.map(({ key, label, position, radius }) => {
        cameraSpacePosition.current.copy(position).applyMatrix4(camera.matrixWorldInverse)
        projectedPosition.current.copy(position).project(camera)
        const isBehind = cameraSpacePosition.current.z >= 0
        const isInsideViewport = viewFrustum.current.intersectsSphere(
          bodySphere.current.set(position, radius),
        )
        let starDirection: Pick<CelestialMarkerState, 'direction'> = {}
        if (key === 'star') {
          const minimumBehindHorizontal = Math.abs(cameraSpacePosition.current.z) * 0.08
          const behindHorizontalSign = cameraSpacePosition.current.x < 0 ? -1 : 1
          starDirection = {
            direction: {
              x: isBehind
                ? behindHorizontalSign *
                  Math.max(Math.abs(cameraSpacePosition.current.x), minimumBehindHorizontal) *
                  camera.projectionMatrix.elements[0]
                : projectedPosition.current.x,
              // Once the star is behind the chase camera, a horizontal cue is
              // more stable than amplifying small camera-height differences.
              y: isBehind ? 0 : -projectedPosition.current.y,
            },
          }
        }
        const status: CelestialMarkerStatus = isBehind
          ? 'behind'
          : isInsideViewport
            ? 'visible'
            : 'offscreen'

        return {
          key,
          label,
          status,
          screenPosition: {
            x: Math.min(92, Math.max(8, ((projectedPosition.current.x + 1) / 2) * 100)),
            y: Math.min(94, Math.max(6, ((1 - projectedPosition.current.y) / 2) * 100)),
          },
          ...starDirection,
        }
      }),
    )
  })

  return null
}

function SystemScene({
  system,
  flightRef,
  advanceFlightFrame,
  simulationElapsedSeconds,
  onMarkersChange,
  settings,
  orbitalVisual,
  effectsEnabled,
  cameraMode,
  cameraTransitionRequested,
  onCameraTransitionComplete,
}: {
  system: GitHubSystem
  flightRef: FlightStateRef
  advanceFlightFrame: (time: number) => void
  simulationElapsedSeconds: RefObject<number>
  onMarkersChange: (markers: CelestialMarkerState[]) => void
  settings: VisualSettings
  orbitalVisual: SystemOrbitalVisual
  effectsEnabled: boolean
  cameraMode: CameraMode
  cameraTransitionRequested: boolean
  onCameraTransitionComplete: () => void
}) {
  const { starAppearance, planets } = system
  const extent = Math.max(20, orbitalVisual.asteroidBelt.outerRadius)
  const shipAppearance = describeShipAppearance(system)

  return (
    <>
      <FlightSimulation advanceFlightFrame={advanceFlightFrame} />
      <color attach="background" args={['#030510']} />
      <ambientLight intensity={0.24} color="#7181a8" />
      <hemisphereLight args={['#8096c9', '#130d20', 0.34]} />
      <pointLight
        color={hsl(starAppearance.coronaHue, 92, 64)}
        intensity={48 * starAppearance.luminosity}
        distance={extent * 2.35}
        decay={1.45}
      />
      <SpaceBackground
        seed={system.starSeed}
        quality={settings.quality}
        reducedMotion={settings.reducedMotion}
        flightRef={flightRef}
        shootingStars={orbitalVisual.shootingStars}
        shootingStarCycleSeconds={orbitalVisual.shootingStarCycleSeconds}
      />
      <ProceduralStar
        appearance={starAppearance}
        quality={settings.quality}
        reducedMotion={settings.reducedMotion}
      />
      {planets.map((planet) => (
        <OrbitingPlanet
          key={planet.repository.id}
          planet={planet}
          simulationElapsedSeconds={simulationElapsedSeconds}
          quality={settings.quality}
          reducedMotion={settings.reducedMotion}
          orbitalVisual={orbitalVisual.planets.find(
            (entry) => entry.repositoryId === planet.repository.id,
          )!.visual}
        />
      ))}
      <OrbitalRockEnvironment
        clusters={orbitalVisual.innerClusters}
        belt={orbitalVisual.asteroidBelt}
      />
      <ProceduralShip
        flightRef={flightRef}
        primaryHue={shipAppearance.primaryHue}
        accentHue={shipAppearance.accentHue}
        quality={settings.quality}
        reducedMotion={settings.reducedMotion}
        effectsEnabled={effectsEnabled}
        visible={cameraMode === 'third-person'}
      />
      <ProceduralCockpit
        flightRef={flightRef}
        primaryHue={shipAppearance.primaryHue}
        accentHue={shipAppearance.accentHue}
        quality={settings.quality}
        visible={cameraMode === 'first-person'}
      />
      <FlightCamera
        flightRef={flightRef}
        mode={cameraMode}
        transitionRequested={cameraTransitionRequested}
        onTransitionComplete={onCameraTransitionComplete}
      />
      <OrientationTracker
        system={system}
        flightRef={flightRef}
        simulationElapsedSeconds={simulationElapsedSeconds}
        onMarkersChange={onMarkersChange}
      />
    </>
  )
}

export const GalaxyScene = memo(function GalaxyScene({
  system,
  initialFlight,
  flightRef,
  advanceFlightFrame,
  simulationElapsedSeconds,
  onMarkersChange,
  paused,
  settings,
  orbitalVisual,
  turboActive,
  cameraMode,
  cameraTransitionId,
}: {
  system: GitHubSystem
  initialFlight: FlightState
  flightRef: FlightStateRef
  advanceFlightFrame: (time: number) => void
  simulationElapsedSeconds: RefObject<number>
  onMarkersChange: (markers: CelestialMarkerState[]) => void
  paused: boolean
  settings: VisualSettings
  orbitalVisual: SystemOrbitalVisual
  turboActive: boolean
  cameraMode: CameraMode
  cameraTransitionId: number
}) {
  const [completedCameraTransition, setCompletedCameraTransition] = useState(cameraTransitionId)
  const cameraTransitioning =
    !settings.reducedMotion && completedCameraTransition !== cameraTransitionId

  useEffect(() => {
    if (completedCameraTransition === cameraTransitionId || settings.reducedMotion) return
    const completionTimer = window.setTimeout(
      () => setCompletedCameraTransition(cameraTransitionId),
      CAMERA_TRANSITION_MILLISECONDS,
    )
    return () => window.clearTimeout(completionTimer)
  }, [cameraTransitionId, completedCameraTransition, settings.reducedMotion])

  const turboProfile = useMemo(
    () => turboVisualProfile(settings.quality, settings.reducedMotion),
    [settings.quality, settings.reducedMotion],
  )
  const farPlane = Math.max(220, orbitalVisual.asteroidBelt.outerRadius * 4)
  const moonCount = orbitalVisual.planets.reduce(
    (total, planet) => total + planet.visual.moons.length,
    0,
  )
  const ringCount = orbitalVisual.planets.filter((planet) => planet.visual.ring).length
  const artificialObjectCount = orbitalVisual.planets.reduce(
    (total, planet) => total + planet.visual.artificialObjects.length,
    0,
  )

  return (
    <div
      className="galaxy-canvas"
      role="img"
      aria-label={cameraMode === 'first-person'
        ? 'Escena tridimensional desde el puesto de pilotaje'
        : 'Escena tridimensional con cámara automática siguiendo la nave'}
      data-testid="active-camera"
      data-camera-mode={cameraMode}
      data-camera-transition={cameraTransitioning ? 'active' : 'idle'}
      data-camera-transition-ms={settings.reducedMotion ? 0 : CAMERA_TRANSITION_MILLISECONDS}
      data-camera-attitude-scale={cameraMode === 'first-person' ? FIRST_PERSON_ATTITUDE_SCALE : 0}
      data-visual-quality={settings.quality}
      data-reduced-motion={settings.reducedMotion}
      data-visual-seed={system.starSeed}
      data-star-count={settings.quality === 'normal' ? 960 : 240}
      data-dust-count={settings.quality === 'normal' ? 120 : 32}
      data-nebula-count={settings.quality === 'normal' ? 2 + (system.starSeed % 3) : 2}
      data-distant-galaxy-count={settings.quality === 'normal' ? 3 + ((system.starSeed >>> 0) % 4) : 2}
      data-moon-count={moonCount}
      data-ring-count={ringCount}
      data-artificial-object-count={artificialObjectCount}
      data-inner-rock-cluster-count={orbitalVisual.innerClusters.length}
      data-asteroid-count={orbitalVisual.asteroidBelt.rocks.length}
      data-asteroid-belt-inner-radius={orbitalVisual.asteroidBelt.innerRadius}
      data-asteroid-belt-outer-radius={orbitalVisual.asteroidBelt.outerRadius}
      data-shooting-star-event-count={orbitalVisual.shootingStars.length}
      data-simulation-state={paused ? 'paused' : 'running'}
      data-turbo-visual-state={turboActive ? 'active' : 'idle'}
      data-turbo-speed-line-count={turboProfile.speedLineCount}
      data-turbo-particle-count={turboProfile.particleCount}
      data-turbo-feedback={turboProfile.feedback}
    >
      <span
        className="scene-observability"
        data-testid="exterior-ship-state"
        data-visible={cameraMode === 'third-person'}
      >
        Nave exterior {cameraMode === 'third-person' ? 'visible' : 'oculta'}
      </span>
      <Canvas
        frameloop={paused ? 'never' : 'always'}
        camera={{
          position: [
            initialFlight.x - Math.sin(initialFlight.heading) * CHASE_CAMERA_BACK_DISTANCE,
            initialFlight.altitude + CHASE_CAMERA_HEIGHT,
            initialFlight.z - Math.cos(initialFlight.heading) * CHASE_CAMERA_BACK_DISTANCE,
          ],
          fov: 64,
          near: 0.008,
          far: farPlane,
        }}
        dpr={settings.dpr}
        gl={{
          antialias: settings.quality === 'normal',
          alpha: false,
          powerPreference: 'high-performance',
        }}
        shadows={settings.quality === 'normal'}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.04
        }}
      >
        <SystemScene
          system={system}
          flightRef={flightRef}
          advanceFlightFrame={advanceFlightFrame}
          simulationElapsedSeconds={simulationElapsedSeconds}
          onMarkersChange={onMarkersChange}
          settings={settings}
          orbitalVisual={orbitalVisual}
          effectsEnabled={!paused}
          cameraMode={cameraMode}
          cameraTransitionRequested={cameraTransitioning}
          onCameraTransitionComplete={() => setCompletedCameraTransition(cameraTransitionId)}
        />
      </Canvas>
    </div>
  )
})

export { SHIP_WORLD_SCALE }
