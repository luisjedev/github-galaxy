import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointsMaterial,
} from 'three'
import {
  NORMAL_FLIGHT_SPEED,
  type FlightState,
} from '../../domain/flight'
import { deterministicUnit } from '../../domain/visual-generation'
import { colorFromHsl, hsl } from './visual-utils'

export const SHIP_WORLD_SCALE = 0.03

function EngineParticles({
  hue,
  flightRef,
}: {
  hue: number
  flightRef: RefObject<FlightState>
}) {
  const geometry = useMemo(() => {
    const count = 28
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color = colorFromHsl(hue, 0.96, 0.68)
    for (let index = 0; index < count; index += 1) {
      const engineSide = index % 2 === 0 ? -1 : 1
      positions.set(
        [
          engineSide * 0.72 + (deterministicUnit(hue, index, 1) - 0.5) * 0.28,
          -0.12 + (deterministicUnit(hue, index, 2) - 0.5) * 0.32,
          -2.15 - deterministicUnit(hue, index, 3) * 6,
        ],
        index * 3,
      )
      colors.set([color.r, color.g, color.b], index * 3)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    result.setAttribute('color', new BufferAttribute(colors, 3))
    return result
  }, [hue])
  const geometryRef = useRef(geometry)
  const material = useRef<PointsMaterial>(null)

  useEffect(() => {
    geometryRef.current = geometry
    return () => geometry.dispose()
  }, [geometry])
  useFrame((_, elapsedSeconds) => {
    const flight = flightRef.current
    const intensity = Math.min(1, Math.abs(flight.speed) / NORMAL_FLIGHT_SPEED)
    const position = geometryRef.current.getAttribute('position') as BufferAttribute
    const speed = (flight.turbo ? 11 : 3 + intensity * 4) * elapsedSeconds
    for (let index = 0; index < position.count; index += 1) {
      let z = position.getZ(index) - speed
      const limit = flight.turbo ? -10 : -5.5
      if (z < limit) z = -2.15
      position.setZ(index, z)
    }
    position.needsUpdate = true
    if (material.current) {
      material.current.size = flight.turbo ? 0.006 : 0.0035
      material.current.opacity = flight.turbo ? 0.9 : 0.5 + intensity * 0.25
    }
  })

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={material}
        vertexColors
        size={0.0035}
        transparent
        opacity={0.5}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}

function EngineTrail({
  side,
  accentHue,
  flightRef,
}: {
  side: number
  accentHue: number
  flightRef: RefObject<FlightState>
}) {
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const flight = flightRef.current
    const intensity = Math.min(1, Math.abs(flight.speed) / NORMAL_FLIGHT_SPEED)
    const trailLength = flight.turbo ? 8.5 : 2.3 + intensity * 2.8
    mesh.current?.position.set(side * 0.72, -0.05, -2.38 - trailLength / 2)
    mesh.current?.scale.set(0.4 + intensity * 0.17, trailLength, 0.4 + intensity * 0.17)
    if (material.current) {
      material.current.opacity = flight.turbo ? 0.88 : 0.32 + intensity * 0.4
    }
  })

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.72, 1, 5]} />
      <meshBasicMaterial
        ref={material}
        color={hsl(accentHue, 100, 68)}
        transparent
        opacity={0.32}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function ProceduralShip({
  flightRef,
  primaryHue,
  accentHue,
}: {
  flightRef: RefObject<FlightState>
  primaryHue: number
  accentHue: number
}) {
  const ship = useRef<Group>(null)
  const attitude = useRef<Group>(null)

  useFrame(() => {
    const flight = flightRef.current
    ship.current?.position.set(flight.x, flight.altitude, flight.z)
    if (ship.current) ship.current.rotation.y = flight.heading
    attitude.current?.rotation.set(flight.pitch, 0, flight.bank)
  }, -50)
  const hullMaterial = (
    <meshStandardMaterial
      color={hsl(primaryHue, 68, 56)}
      emissive={hsl(primaryHue, 72, 32)}
      emissiveIntensity={0.22}
      metalness={0.38}
      roughness={0.36}
      flatShading
    />
  )
  const darkHullMaterial = (
    <meshStandardMaterial
      color={hsl(primaryHue, 50, 38)}
      emissive={hsl(primaryHue, 62, 24)}
      emissiveIntensity={0.16}
      metalness={0.44}
      roughness={0.4}
      flatShading
    />
  )

  return (
    <group ref={ship} scale={SHIP_WORLD_SCALE}>
      <group ref={attitude}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[1.05, 4.2, 5]} />
          {hullMaterial}
        </mesh>
        <mesh position={[0, 0.46, 0.48]} scale={[0.72, 0.52, 1.08]} castShadow>
          <octahedronGeometry args={[0.68, 0]} />
          <meshStandardMaterial
            color={hsl(accentHue, 64, 58)}
            emissive={hsl(accentHue, 82, 36)}
            emissiveIntensity={0.58}
            metalness={0.22}
            roughness={0.24}
            flatShading
          />
        </mesh>

        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              position={[side * 1.66, -0.06, -0.55]}
              rotation={[0, side * 0.16, side * 0.08]}
              castShadow
            >
              <boxGeometry args={[2.7, 0.16, 1.55]} />
              {darkHullMaterial}
            </mesh>
            <mesh position={[side * 1.92, 0.02, -0.7]} rotation={[0, side * 0.14, 0]}>
              <boxGeometry args={[1.35, 0.07, 0.82]} />
              <meshStandardMaterial
                color={hsl(accentHue, 58, 38)}
                emissive={hsl(accentHue, 72, 30)}
                emissiveIntensity={0.28}
                metalness={0.3}
                roughness={0.5}
              />
            </mesh>
            <mesh position={[side * 0.72, -0.05, -1.72]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.34, 0.46, 1.15, 6]} />
              {darkHullMaterial}
            </mesh>
            <mesh position={[side * 0.72, -0.05, -2.32]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.34, 0.12, 8]} />
              <meshBasicMaterial
                color={hsl(accentHue, 100, 72)}
                toneMapped={false}
              />
            </mesh>
            <EngineTrail side={side} accentHue={accentHue} flightRef={flightRef} />
          </group>
        ))}

        <mesh position={[0, -0.24, 1.28]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.22, 0.72, 4]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 54, 40)}
            emissive={hsl(primaryHue, 62, 24)}
            emissiveIntensity={0.16}
            metalness={0.42}
            roughness={0.38}
          />
        </mesh>
        <mesh position={[-1.78, 0.04, -0.2]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color="#ff607d" toneMapped={false} />
        </mesh>
        <mesh position={[1.78, 0.04, -0.2]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color="#79f6ff" toneMapped={false} />
        </mesh>
        <pointLight
          position={[0, 0.38, 0.48]}
          color={hsl(accentHue, 100, 68)}
          intensity={2.2}
          distance={7}
        />
        <EngineParticles hue={accentHue} flightRef={flightRef} />
      </group>
    </group>
  )
}
