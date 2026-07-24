import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import { AdditiveBlending, DoubleSide, Group } from 'three'
import type { FlightState } from '../../domain/flight'
import type { VisualQuality } from '../../domain/visual-generation'
import { hsl } from './visual-utils'

function CockpitFrame({ primaryHue }: { primaryHue: number }) {
  const material = (
    <meshStandardMaterial
      color={hsl(primaryHue, 42, 18)}
      emissive={hsl(primaryHue, 55, 10)}
      emissiveIntensity={0.35}
      metalness={0.84}
      roughness={0.3}
      flatShading
    />
  )

  return (
    <>
      <mesh position={[-0.075, 0.002, -0.13]} rotation={[0, 0, -0.22]} renderOrder={20}>
        <boxGeometry args={[0.012, 0.17, 0.012]} />
        {material}
      </mesh>
      <mesh position={[0.075, 0.002, -0.13]} rotation={[0, 0, 0.22]} renderOrder={20}>
        <boxGeometry args={[0.012, 0.17, 0.012]} />
        {material}
      </mesh>
      <mesh position={[0, 0.068, -0.13]} renderOrder={20}>
        <boxGeometry args={[0.145, 0.009, 0.012]} />
        {material}
      </mesh>
    </>
  )
}

function Instruments({ accentHue, quality }: { accentHue: number; quality: VisualQuality }) {
  const screenCount = quality === 'normal' ? 3 : 2
  return (
    <group position={[0, -0.066, -0.125]} rotation={[-0.2, 0, 0]}>
      {Array.from({ length: screenCount }, (_, index) => {
        const x = (index - (screenCount - 1) / 2) * 0.038
        return (
          <group key={index} position={[x, 0.012, -0.01]}>
            <mesh renderOrder={22}>
              <boxGeometry args={[0.031, 0.022, 0.006]} />
              <meshStandardMaterial color="#07101a" metalness={0.65} roughness={0.24} />
            </mesh>
            <mesh position={[0, 0, 0.0035]} renderOrder={23}>
              <planeGeometry args={[0.025, 0.015]} />
              <meshBasicMaterial color={hsl(accentHue, 100, 67)} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[-0.055, -0.007, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={22}>
        <cylinderGeometry args={[0.004, 0.006, 0.035, quality === 'normal' ? 8 : 4]} />
        <meshStandardMaterial color={hsl(accentHue, 75, 42)} metalness={0.72} roughness={0.25} />
      </mesh>
      <mesh position={[0.055, -0.007, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={22}>
        <cylinderGeometry args={[0.004, 0.006, 0.035, quality === 'normal' ? 8 : 4]} />
        <meshStandardMaterial color={hsl(accentHue, 75, 42)} metalness={0.72} roughness={0.25} />
      </mesh>
    </group>
  )
}

export function ProceduralCockpit({
  flightRef,
  primaryHue,
  accentHue,
  quality,
  visible,
}: {
  flightRef: RefObject<FlightState>
  primaryHue: number
  accentHue: number
  quality: VisualQuality
  visible: boolean
}) {
  const { camera } = useThree()
  const cockpit = useRef<Group>(null)
  const turboLight = useRef<Group>(null)

  useFrame(() => {
    if (!cockpit.current || !visible) return
    cockpit.current.position.copy(camera.position)
    cockpit.current.quaternion.copy(camera.quaternion)
    if (turboLight.current) {
      turboLight.current.scale.setScalar(flightRef.current.turbo ? 1.35 : 0.82)
    }
  }, -30)

  return (
    <group ref={cockpit} visible={visible}>
      <CockpitFrame primaryHue={primaryHue} />

      <mesh position={[0, 0, -0.135]} renderOrder={18}>
        <planeGeometry args={[0.145, 0.13]} />
        <meshBasicMaterial
          color={hsl(accentHue, 68, 55)}
          transparent
          opacity={quality === 'normal' ? 0.045 : 0.025}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, -0.077, -0.125]} rotation={[-0.2, 0, 0]} renderOrder={21}>
        <boxGeometry args={[0.165, 0.046, 0.055, quality === 'normal' ? 2 : 1, 1, 1]} />
        <meshStandardMaterial
          color={hsl(primaryHue, 45, 14)}
          emissive={hsl(primaryHue, 48, 7)}
          emissiveIntensity={0.35}
          metalness={0.75}
          roughness={0.32}
          flatShading
        />
      </mesh>
      <Instruments accentHue={accentHue} quality={quality} />

      <group ref={turboLight} position={[0, -0.052, -0.089]}>
        <mesh renderOrder={24}>
          <circleGeometry args={[0.004, quality === 'normal' ? 12 : 6]} />
          <meshBasicMaterial
            color={hsl((accentHue + 42) % 360, 100, 66)}
            transparent
            opacity={0.95}
            blending={AdditiveBlending}
            toneMapped={false}
            depthTest={false}
          />
        </mesh>
      </group>

      {/* A dedicated exterior composition avoids exposing clipped parts of the chase model. */}
      <mesh position={[0, -0.057, -0.34]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={15}>
        <coneGeometry args={[0.028, 0.26, quality === 'normal' ? 8 : 5]} />
        <meshStandardMaterial
          color={hsl(primaryHue, 58, 35)}
          emissive={hsl(primaryHue, 58, 15)}
          emissiveIntensity={0.25}
          metalness={0.76}
          roughness={0.28}
          flatShading
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.105, -0.062, -0.3]} rotation={[0, 0, side * -0.04]} renderOrder={14}>
          <boxGeometry args={[0.15, 0.009, 0.105]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 48, 24)}
            emissive={hsl(accentHue, 70, 14)}
            emissiveIntensity={0.2}
            metalness={0.82}
            roughness={0.3}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}
