import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Group, Vector3 } from 'three'
import { describeShipAppearance, type FlightState } from '../domain/flight'
import {
  FULL_ROTATION_RADIANS,
  type GitHubSystem,
  type PlanetDescriptor,
} from '../domain/github-system'

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function ChaseCamera({ flight }: { flight: FlightState }) {
  const { camera } = useThree()
  const desiredPosition = useRef(new Vector3())
  const lookAt = useRef(new Vector3())

  useFrame((_, elapsedSeconds) => {
    const forwardX = Math.sin(flight.heading)
    const forwardZ = Math.cos(flight.heading)
    desiredPosition.current.set(
      flight.x - forwardX * 15,
      flight.altitude + 8,
      flight.z - forwardZ * 15,
    )
    camera.position.lerp(
      desiredPosition.current,
      1 - Math.exp(-7 * Math.min(elapsedSeconds, 0.05)),
    )
    lookAt.current.set(
      flight.x + forwardX * 4,
      flight.altitude + 0.7,
      flight.z + forwardZ * 4,
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
  const engineIntensity = Math.min(1, Math.abs(flight.speed) / 12)
  const trailLength = flight.turbo ? 7 : 2.5 + engineIntensity * 2.5

  return (
    <group
      position={[flight.x, flight.altitude, flight.z]}
      rotation={[0, flight.heading, 0]}
      scale={0.58}
    >
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
  )
}

function OrbitingPlanet({ planet }: { planet: PlanetDescriptor }) {
  const orbit = useRef<Group>(null)
  const planetMesh = useRef<Group>(null)
  const { appearance } = planet

  useFrame(({ clock }) => {
    if (!orbit.current || !planetMesh.current) return
    orbit.current.rotation.y =
      planet.initialPhase +
      (clock.elapsedTime / planet.orbitPeriodSeconds) * FULL_ROTATION_RADIANS
    planetMesh.current.rotation.y = planet.initialRotation + clock.elapsedTime * planet.rotationSpeed
  })

  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[planet.orbitRadius, 0.018, 3, 128]} />
        <meshBasicMaterial color="#8790bd" transparent opacity={0.2} depthWrite={false} />
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

function SystemScene({ system, flight }: { system: GitHubSystem; flight: FlightState }) {
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
        <OrbitingPlanet key={planet.repository.id} planet={planet} />
      ))}
      <ProceduralShip
        flight={flight}
        primaryHue={shipAppearance.primaryHue}
        accentHue={shipAppearance.accentHue}
      />
      <ChaseCamera flight={flight} />
    </>
  )
}

export function GalaxyScene({ system, flight }: { system: GitHubSystem; flight: FlightState }) {
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
        camera={{ position: [0, 8, -25], fov: 58, near: 0.1, far: farPlane }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
      >
        <SystemScene system={system} flight={flight} />
      </Canvas>
    </div>
  )
}
