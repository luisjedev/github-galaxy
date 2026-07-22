import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Frustum, Group, Matrix4, Sphere, Vector3 } from 'three'
import {
  describeShipAppearance,
  NORMAL_FLIGHT_SPEED,
  type FlightState,
} from '../domain/flight'
import { STAR_RADIUS, type CelestialBodyKey } from '../domain/celestial-interaction'
import {
  planetOrbitPhase,
  planetPositionAt,
  type GitHubSystem,
  type PlanetDescriptor,
} from '../domain/github-system'

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

const MAX_PLANET_MARKERS = 5
const MARKER_UPDATE_INTERVAL_MS = 100

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
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
      flight.x - forwardX * 0.85,
      flight.altitude + 0.22 - forwardY * 0.85,
      flight.z - forwardZ * 0.85,
    )
    camera.position.lerp(
      desiredPosition.current,
      1 - Math.exp(-7 * frameSeconds),
    )
    lookAt.current.set(
      flight.x + forwardX * 7,
      flight.altitude + 0.05 + forwardY * 7,
      flight.z + forwardZ * 7,
    )
    camera.lookAt(lookAt.current)
  })

  return null
}

function ProceduralShip({
  flight,
  primaryHue,
  accentHue,
}: {
  flight: FlightState
  primaryHue: number
  accentHue: number
}) {
  const engineIntensity = Math.min(1, Math.abs(flight.speed) / NORMAL_FLIGHT_SPEED)
  const trailLength = flight.turbo ? 7 : 2.5 + engineIntensity * 2.5

  return (
    <group
      position={[flight.x, flight.altitude, flight.z]}
      rotation={[0, flight.heading, 0]}
      scale={0.06}
    >
      <group rotation={[flight.pitch, 0, flight.bank]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[1.05, 4.2, 4]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 72, 48)}
            metalness={0.38}
            roughness={0.42}
            flatShading
          />
        </mesh>
        <mesh position={[-1.65, -0.05, -0.55]} rotation={[0, -0.16, -0.08]} castShadow>
          <boxGeometry args={[2.7, 0.16, 1.55]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 62, 30)}
            metalness={0.32}
            roughness={0.5}
            flatShading
          />
        </mesh>
        <mesh position={[1.65, -0.05, -0.55]} rotation={[0, 0.16, 0.08]} castShadow>
          <boxGeometry args={[2.7, 0.16, 1.55]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 62, 30)}
            metalness={0.32}
            roughness={0.5}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.45, 0.4]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color={hsl(accentHue, 100, 78)}
            emissive={hsl(accentHue, 100, 50)}
            emissiveIntensity={2.2}
            flatShading
          />
        </mesh>
        <pointLight
          position={[0, 0.45, 0.5]}
          color={hsl(accentHue, 100, 68)}
          intensity={3}
          distance={9}
        />
        <mesh
          position={[0, 0, -2.2 - trailLength / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.55 + engineIntensity * 0.3, trailLength, 0.55 + engineIntensity * 0.3]}
        >
          <coneGeometry args={[0.75, 1, 5]} />
          <meshBasicMaterial
            color={hsl(accentHue, 100, 68)}
            transparent
            opacity={0.35 + engineIntensity * 0.5}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  )
}

function OrbitingPlanet({
  planet,
  simulationStartedAt,
}: {
  planet: PlanetDescriptor
  simulationStartedAt: number
}) {
  const orbit = useRef<Group>(null)
  const planetMesh = useRef<Group>(null)
  const { appearance } = planet

  useFrame(() => {
    if (!orbit.current || !planetMesh.current) return
    const elapsedSeconds = (performance.now() - simulationStartedAt) / 1_000
    orbit.current.rotation.y = planetOrbitPhase(planet, elapsedSeconds)
    planetMesh.current.rotation.y =
      planet.initialRotation + elapsedSeconds * planet.rotationSpeed
  })

  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[planet.orbitRadius, 0.012, 3, 128]} />
        <meshBasicMaterial color="#8790bd" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <group ref={orbit}>
        <group ref={planetMesh} position={[planet.orbitRadius, 0, 0]}>
          <mesh castShadow receiveShadow>
            <icosahedronGeometry args={[planet.radius, 2]} />
            <meshStandardMaterial
              color={hsl(appearance.baseHue, appearance.saturation, appearance.lightness)}
              emissive={hsl(appearance.accentHue, 70, 32)}
              emissiveIntensity={appearance.luminosity * 0.22}
              roughness={appearance.state === 'archived' ? 0.92 : 0.68}
              flatShading
            />
          </mesh>
          <mesh
            position={[planet.radius * -0.28, planet.radius * 0.42, planet.radius * 0.76]}
            scale={[1.25, 0.45, 0.7]}
          >
            <icosahedronGeometry args={[planet.radius * 0.36, 0]} />
            <meshStandardMaterial
              color={hsl(appearance.accentHue, 72, 68)}
              transparent
              opacity={appearance.state === 'archived' ? 0.18 : 0.58}
              flatShading
            />
          </mesh>
          {appearance.hasRing ? (
            <mesh rotation={[Math.PI / 2.7, 0.25, 0]}>
              <torusGeometry args={[planet.radius * 1.55, planet.radius * 0.07, 4, 48]} />
              <meshStandardMaterial
                color={hsl(appearance.ringHue, 85, 72)}
                emissive={hsl(appearance.ringHue, 80, 42)}
                emissiveIntensity={0.5}
                flatShading
              />
            </mesh>
          ) : null}
        </group>
      </group>
    </>
  )
}

function OrientationTracker({
  system,
  simulationStartedAt,
  onMarkersChange,
}: {
  system: GitHubSystem
  simulationStartedAt: number
  onMarkersChange: (markers: CelestialMarkerState[]) => void
}) {
  const { camera } = useThree()
  const lastPublishedAt = useRef(0)
  const cameraSpacePosition = useRef(new Vector3())
  const projectedPosition = useRef(new Vector3())
  const projectionScreenMatrix = useRef(new Matrix4())
  const viewFrustum = useRef(new Frustum())
  const bodySphere = useRef(new Sphere())

  useFrame(() => {
    const now = performance.now()
    if (now - lastPublishedAt.current < MARKER_UPDATE_INTERVAL_MS) return
    lastPublishedAt.current = now
    camera.updateMatrixWorld()
    projectionScreenMatrix.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    viewFrustum.current.setFromProjectionMatrix(projectionScreenMatrix.current)
    const elapsedSeconds = (now - simulationStartedAt) / 1_000
    const relevantPlanets = [...system.planets]
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, MAX_PLANET_MARKERS)
    const bodies = [
      {
        key: 'star' as const,
        label: `Estrella de ${system.profile.login}`,
        position: new Vector3(),
        radius: STAR_RADIUS,
      },
      ...relevantPlanets.map((planet) => {
        const position = planetPositionAt(planet, elapsedSeconds)
        return {
          key: `planet:${planet.repository.id}` as const,
          label: planet.repository.name,
          position: new Vector3(position.x, position.y, position.z),
          radius: planet.radius,
        }
      }),
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
}: {
  system: GitHubSystem
  flight: FlightState
  simulationStartedAt: number
  onMarkersChange: (markers: CelestialMarkerState[]) => void
}) {
  const { starAppearance, planets } = system
  const extent = Math.max(20, ...planets.map((planet) => planet.orbitRadius + planet.radius))
  const shipAppearance = describeShipAppearance(system)

  return (
    <>
      <ambientLight intensity={0.38} />
      <pointLight
        color={hsl(starAppearance.coronaHue, 95, 68)}
        intensity={18}
        distance={extent * 2.4}
        decay={1.35}
      />
      <mesh>
        <icosahedronGeometry args={[4, 2]} />
        <meshBasicMaterial color={hsl(starAppearance.primaryHue, 94, 64)} />
      </mesh>
      {planets.map((planet) => (
        <OrbitingPlanet
          key={planet.repository.id}
          planet={planet}
          simulationStartedAt={simulationStartedAt}
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
  const farPlane = Math.max(
    160,
    ...system.planets.map((planet) => (planet.orbitRadius + planet.radius) * 4),
  )

  return (
    <div
      className="galaxy-canvas"
      role="img"
      aria-label="Escena tridimensional con cámara automática siguiendo la nave"
    >
      <Canvas
        camera={{ position: [0, 0.22, -10.85], fov: 64, near: 0.1, far: farPlane }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
      >
        <SystemScene
          system={system}
          flight={flight}
          simulationStartedAt={simulationStartedAt}
          onMarkersChange={onMarkersChange}
        />
      </Canvas>
    </div>
  )
}
