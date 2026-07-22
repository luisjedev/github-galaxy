import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'
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
import {
  selectVisualQuality,
  type VisualQuality,
} from '../domain/visual-generation'
import { OrbitingPlanet } from './scene/ProceduralPlanet'
import { ProceduralShip, SHIP_WORLD_SCALE } from './scene/ProceduralShip'
import { ProceduralStar } from './scene/ProceduralStar'
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

interface VisualSettings {
  quality: VisualQuality
  reducedMotion: boolean
  dpr: [number, number]
}

const PLANET_MARKER_DISCOVERY_CLEARANCE = 14
// Scale the chase rig with the ship so its screen-space composition stays unchanged.
const SHIP_CAMERA_COMPOSITION_SCALE = SHIP_WORLD_SCALE / 0.06
const CHASE_CAMERA_BACK_DISTANCE = 0.85 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_HEIGHT = 0.22 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_LOOK_DISTANCE = 7 * SHIP_CAMERA_COMPOSITION_SCALE
const CHASE_CAMERA_LOOK_HEIGHT = 0.05 * SHIP_CAMERA_COMPOSITION_SCALE

function usesSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!context) return true
    const rendererInfo = context.getExtension('WEBGL_debug_renderer_info')
    const renderer = rendererInfo
      ? String(context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER))
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return /swiftshader|llvmpipe|software/i.test(renderer)
  } catch {
    return true
  }
}

function readVisualSettings(): VisualSettings {
  const quality = selectVisualQuality({
    hardwareConcurrency: navigator.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio,
    softwareRenderer: usesSoftwareRenderer(),
  })
  return {
    quality,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    dpr: quality === 'normal' ? [1, Math.min(1.6, window.devicePixelRatio)] : [1, 1.15],
  }
}

function planetMarkerDiscoveryRadius(planetRadius: number): number {
  return planetRadius + PLANET_MARKER_DISCOVERY_CLEARANCE
}

function ChaseCamera({ flight }: { flight: FlightState }) {
  const { camera } = useThree()
  const desiredPosition = useRef(new Vector3())
  const lookAt = useRef(new Vector3())
  const cameraPitch = useRef(0)

  useFrame((_, elapsedSeconds) => {
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
  })

  return null
}

function OrientationTracker({
  system,
  flight,
  simulationStartedAt,
  onMarkersChange,
}: {
  system: GitHubSystem
  flight: FlightState
  simulationStartedAt: number
  onMarkersChange: (markers: CelestialMarkerState[]) => void
}) {
  const { camera } = useThree()
  const cameraSpacePosition = useRef(new Vector3())
  const projectedPosition = useRef(new Vector3())
  const projectionScreenMatrix = useRef(new Matrix4())
  const viewFrustum = useRef(new Frustum())
  const bodySphere = useRef(new Sphere())

  useFrame(() => {
    const now = performance.now()
    camera.updateMatrixWorld()
    projectionScreenMatrix.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    viewFrustum.current.setFromProjectionMatrix(projectionScreenMatrix.current)
    const elapsedSeconds = (now - simulationStartedAt) / 1_000
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
              y: isBehind
                ? -cameraSpacePosition.current.y * camera.projectionMatrix.elements[5]
                : -projectedPosition.current.y,
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
  flight,
  simulationStartedAt,
  onMarkersChange,
  settings,
}: {
  system: GitHubSystem
  flight: FlightState
  simulationStartedAt: number
  onMarkersChange: (markers: CelestialMarkerState[]) => void
  settings: VisualSettings
}) {
  const { starAppearance, planets } = system
  const extent = Math.max(20, ...planets.map((planet) => planet.orbitRadius + planet.radius))
  const shipAppearance = describeShipAppearance(system)

  return (
    <>
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
        flight={flight}
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
          simulationStartedAt={simulationStartedAt}
          quality={settings.quality}
        />
      ))}
      <ProceduralShip
        flight={flight}
        primaryHue={shipAppearance.primaryHue}
        accentHue={shipAppearance.accentHue}
      />
      <ChaseCamera flight={flight} />
      <OrientationTracker
        system={system}
        flight={flight}
        simulationStartedAt={simulationStartedAt}
        onMarkersChange={onMarkersChange}
      />
    </>
  )
}

export function GalaxyScene({
  system,
  flight,
  simulationStartedAt,
  onMarkersChange,
}: {
  system: GitHubSystem
  flight: FlightState
  simulationStartedAt: number
  onMarkersChange: (markers: CelestialMarkerState[]) => void
}) {
  const [settings] = useState(readVisualSettings)
  const farPlane = Math.max(
    220,
    ...system.planets.map((planet) => (planet.orbitRadius + planet.radius) * 4),
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
    >
      <Canvas
        camera={{
          position: [
            flight.x - Math.sin(flight.heading) * CHASE_CAMERA_BACK_DISTANCE,
            flight.altitude + CHASE_CAMERA_HEIGHT,
            flight.z - Math.cos(flight.heading) * CHASE_CAMERA_BACK_DISTANCE,
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
          flight={flight}
          simulationStartedAt={simulationStartedAt}
          onMarkersChange={onMarkersChange}
          settings={settings}
        />
      </Canvas>
    </div>
  )
}

export { SHIP_WORLD_SCALE }
