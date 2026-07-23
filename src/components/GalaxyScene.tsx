import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { memo, useRef, type RefObject } from 'react'
import {
  ACESFilmicToneMapping,
  Frustum,
  Matrix4,
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
import { OrbitingPlanet } from './scene/ProceduralPlanet'
import { ProceduralShip, SHIP_WORLD_SCALE } from './scene/ProceduralShip'
import { ProceduralStar } from './scene/ProceduralStar'
import { OrbitalRockEnvironment } from './scene/OrbitalDetails'
import { SpaceBackground } from './scene/SpaceBackground'
import { hsl } from './scene/visual-utils'

export type CelestialMarkerStatus = 'visible' | 'offscreen' | 'behind'

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

const PLANET_MARKER_DISCOVERY_CLEARANCE = 18
// Scale the chase rig with the ship so its screen-space composition stays unchanged.
const SHIP_CAMERA_COMPOSITION_SCALE = SHIP_WORLD_SCALE / 0.06
const CHASE_CAMERA_BACK_DISTANCE = 0.85 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_HEIGHT = 0.22 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_LOOK_DISTANCE = 7 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_LOOK_HEIGHT = 0.05 * SHIP_CAMERA_COMPOSITION_SCALE

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

function ChaseCamera({ flightRef }: { flightRef: FlightStateRef }) {
  const { camera } = useThree()
  const desiredPosition = useRef(new Vector3())
  const lookAt = useRef(new Vector3())
  const cameraPitch = useRef(0)

  useFrame((_, elapsedSeconds) => {
    const flight = flightRef.current
    const frameSeconds = Math.min(elapsedSeconds, 0.05)
    const targetPitch = flight.pitch * 0.45
    cameraPitch.current +=
      (targetPitch - cameraPitch.current) * (1 - Math.exp(-4 * frameSeconds))

    const horizontalForward = Math.cos(cameraPitch.current)
    const forwardX = Math.sin(flight.heading) * horizontalForward
    const forwardY = -Math.sin(cameraPitch.current)
    const forwardZ = Math.cos(flight.heading) * horizontalForward
    desiredPosition.current.set(
      flight.x - forwardX * CHASE_CAMERA_BACK_DISTANCE,
      flight.altitude + CHASE_CAMERA_HEIGHT - forwardY * CHASE_CAMERA_BACK_DISTANCE,
      flight.z - forwardZ * CHASE_CAMERA_BACK_DISTANCE,
    )
    camera.position.lerp(
      desiredPosition.current,
      1 - Math.exp(-7 * frameSeconds),
    )
    lookAt.current.set(
      flight.x + forwardX * CHASE_CAMERA_LOOK_DISTANCE,
      flight.altitude + CHASE_CAMERA_LOOK_HEIGHT + forwardY * CHASE_CAMERA_LOOK_DISTANCE,
      flight.z + forwardZ * CHASE_CAMERA_LOOK_DISTANCE,
    )
    camera.lookAt(lookAt.current)
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
}: {
  system: GitHubSystem
  flightRef: FlightStateRef
  advanceFlightFrame: (time: number) => void
  simulationElapsedSeconds: RefObject<number>
  onMarkersChange: (markers: CelestialMarkerState[]) => void
  settings: VisualSettings
  orbitalVisual: SystemOrbitalVisual
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
      />
      <ChaseCamera flightRef={flightRef} />
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
}) {
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
      aria-label="Escena tridimensional con cámara automática siguiendo la nave"
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
    >
      <Canvas
        frameloop={paused ? 'never' : 'always'}
        camera={{
          position: [
            initialFlight.x - Math.sin(initialFlight.heading) * CHASE_CAMERA_BACK_DISTANCE,
            initialFlight.altitude + CHASE_CAMERA_HEIGHT,
            initialFlight.z - Math.cos(initialFlight.heading) * CHASE_CAMERA_BACK_DISTANCE,
          ],
          fov: 64,
          near: 0.1,
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
        />
      </Canvas>
    </div>
  )
})

export { SHIP_WORLD_SCALE }
