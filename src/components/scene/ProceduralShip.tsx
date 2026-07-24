import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  ShaderMaterial,
} from 'three'
import { NORMAL_FLIGHT_SPEED, type FlightState } from '../../domain/flight'
import {
  advanceTurboVisualIntensity,
  isTurboVisualActive,
  turboVisualProfile,
  type TurboVisualProfile,
} from '../../domain/turbo-visual'
import { deterministicUnit, type VisualQuality } from '../../domain/visual-generation'
import { colorFromHsl, hsl } from './visual-utils'

export const SHIP_WORLD_SCALE = 0.03

function createWingGeometry(): BufferGeometry {
  const outline = [
    [0.42, 0.92],
    [1.18, 0.58],
    [3.28, -1.2],
    [2.72, -2.12],
    [0.58, -1.48],
  ] as const
  const thickness = 0.11
  const positions = outline.flatMap(([x, z]) => [x, thickness, z])
  positions.push(...outline.flatMap(([x, z]) => [x, -thickness, z]))

  const indices: number[] = []
  for (let index = 1; index < outline.length - 1; index += 1) {
    indices.push(0, index, index + 1)
    indices.push(5, 5 + index + 1, 5 + index)
  }
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length
    indices.push(index, next, 5 + next, index, 5 + next, 5 + index)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function SweptWing({
  side,
  primaryHue,
  accentHue,
}: {
  side: number
  primaryHue: number
  accentHue: number
}) {
  const geometry = useMemo(() => createWingGeometry(), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group scale={[side, 1, 1]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={hsl(primaryHue, 54, 34)}
          emissive={hsl(primaryHue, 62, 18)}
          emissiveIntensity={0.22}
          metalness={0.82}
          roughness={0.28}
          flatShading
        />
      </mesh>

      {/* Raised wing armour makes the silhouette read from the chase camera. */}
      <mesh position={[1.72, 0.14, -0.62]} rotation={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[2.45, 0.14, 0.52, 3, 1, 1]} />
        <meshStandardMaterial
          color={hsl(primaryHue, 62, 47)}
          emissive={hsl(primaryHue, 64, 25)}
          emissiveIntensity={0.2}
          metalness={0.7}
          roughness={0.25}
          flatShading
        />
      </mesh>
      <mesh position={[1.81, 0.235, -0.5]} rotation={[0, 0.707, 0]}>
        <boxGeometry args={[2.58, 0.035, 0.075]} />
        <meshBasicMaterial
          color={hsl(accentHue, 100, 70)}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[2.68, 0.13, -1.47]} rotation={[0, 0.42, 0]}>
        <boxGeometry args={[0.76, 0.08, 0.28]} />
        <meshStandardMaterial
          color={hsl(accentHue, 74, 38)}
          emissive={hsl(accentHue, 100, 48)}
          emissiveIntensity={0.7}
          metalness={0.5}
          roughness={0.24}
        />
      </mesh>

      {/* Navigation beacon. */}
      <mesh position={[3.08, 0.04, -1.35]}>
        <sphereGeometry args={[0.105, 12, 8]} />
        <meshBasicMaterial
          color={side < 0 ? '#ff3f72' : '#59f7ff'}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function TurboSpeedLines({
  hue,
  profile,
  intensityRef,
  enabled,
}: {
  hue: number
  profile: TurboVisualProfile
  intensityRef: RefObject<number>
  enabled: boolean
}) {
  const lines = useRef<LineSegments>(null)
  const material = useRef<LineBasicMaterial>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(profile.speedLineCount * 6)
    for (let index = 0; index < profile.speedLineCount; index += 1) {
      const angle = deterministicUnit(hue, index, 10) * Math.PI * 2
      // Fill the chase-camera frustum instead of clustering the streaks around the ship.
      const radius = 3.2 + deterministicUnit(hue, index, 11) * 20.8
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * 0.88
      const z = -13 + deterministicUnit(hue, index, 12) * 22
      const length = 0.9 + deterministicUnit(hue, index, 13) * 3.4
      positions.set([x, y, z, x, y, z - length], index * 6)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    return result
  }, [hue, profile.speedLineCount])

  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((_, elapsedSeconds) => {
    const intensity = intensityRef.current
    const position = geometry.getAttribute('position') as BufferAttribute
    const movement = elapsedSeconds * (16 + intensity * 42) * profile.motionScale
    for (let index = 0; index < position.count; index += 2) {
      const length = position.getZ(index) - position.getZ(index + 1)
      let z = position.getZ(index) - movement
      if (z < -14) z += 23
      position.setZ(index, z)
      position.setZ(index + 1, z - length)
    }
    position.needsUpdate = true
    if (material.current) material.current.opacity = intensity * 0.5
    if (lines.current) lines.current.visible = enabled && intensity > 0.01
  })

  return (
    <lineSegments
      ref={lines}
      geometry={geometry}
      visible={enabled}
      frustumCulled={false}
      renderOrder={4}
    >
      <lineBasicMaterial
        ref={material}
        color="#ffffff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  )
}

function EngineParticles({
  hue,
  flightRef,
  profile,
  intensityRef,
}: {
  hue: number
  flightRef: RefObject<FlightState>
  profile: TurboVisualProfile
  intensityRef: RefObject<number>
}) {
  const geometry = useMemo(() => {
    const count = profile.particleCount
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const hotColor = colorFromHsl(hue, 0.98, 0.78)
    const coolColor = colorFromHsl((hue + 38) % 360, 0.9, 0.58)
    for (let index = 0; index < count; index += 1) {
      const engineSide = index % 2 === 0 ? -1 : 1
      positions.set(
        [
          engineSide * 1.18 + (deterministicUnit(hue, index, 1) - 0.5) * 0.46,
          -0.08 + (deterministicUnit(hue, index, 2) - 0.5) * 0.38,
          -2.52 - deterministicUnit(hue, index, 3) * 6.5,
        ],
        index * 3,
      )
      const mix = deterministicUnit(hue, index, 4)
      colors.set(
        [
          hotColor.r + (coolColor.r - hotColor.r) * mix,
          hotColor.g + (coolColor.g - hotColor.g) * mix,
          hotColor.b + (coolColor.b - hotColor.b) * mix,
        ],
        index * 3,
      )
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    result.setAttribute('color', new BufferAttribute(colors, 3))
    return result
  }, [hue, profile.particleCount])
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uOpacity: { value: 0.5 },
      uSize: { value: 1.35 },
    }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((_, elapsedSeconds) => {
    const flight = flightRef.current
    const flightIntensity = Math.min(1, Math.abs(flight.speed) / NORMAL_FLIGHT_SPEED)
    const turboIntensity = intensityRef.current
    const position = geometry.getAttribute('position') as BufferAttribute
    const speed = (3.5 + flightIntensity * 5 + turboIntensity * 5) * elapsedSeconds
    const limit = -7 - turboIntensity * 5
    for (let index = 0; index < position.count; index += 1) {
      let z = position.getZ(index) - speed
      if (z < limit) z = -2.52
      position.setZ(index, z)
    }
    position.needsUpdate = true
    if (material.current) {
      material.current.uniforms.uSize.value = 1.1 + flightIntensity * 0.7 + turboIntensity * 0.8
      material.current.uniforms.uOpacity.value = 0.4 + flightIntensity * 0.32 + turboIntensity * 0.18
    }
  })

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={`
          attribute vec3 color;
          varying vec3 vColor;
          uniform float uSize;

          void main() {
            vColor = color;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(uSize / max(0.12, -viewPosition.z), 1.0, 8.0);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          uniform float uOpacity;

          void main() {
            float distanceToCenter = length(gl_PointCoord - vec2(0.5));
            float softDisc = 1.0 - smoothstep(0.16, 0.5, distanceToCenter);
            if (softDisc < 0.01) discard;
            gl_FragColor = vec4(vColor, softDisc * uOpacity);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function EngineExhaust({
  side,
  accentHue,
  flightRef,
  intensityRef,
}: {
  side: number
  accentHue: number
  flightRef: RefObject<FlightState>
  intensityRef: RefObject<number>
}) {
  const outer = useRef<Mesh>(null)
  const core = useRef<Mesh>(null)
  const outerMaterial = useRef<MeshBasicMaterial>(null)
  const coreMaterial = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    const flight = flightRef.current
    const flightIntensity = Math.min(1, Math.abs(flight.speed) / NORMAL_FLIGHT_SPEED)
    const turboIntensity = intensityRef.current
    const pulse = 0.94 + Math.sin(clock.elapsedTime * 22 + side) * 0.06
    const trailLength = 0.7 + flightIntensity * 3.5 + turboIntensity * 5.3
    const coreLength = trailLength * (0.62 + turboIntensity * 0.16)
    const outerWidth = 0.2 + flightIntensity * 0.1 + turboIntensity * 0.08
    outer.current?.position.set(side * 1.18, -0.08, -2.56 - trailLength / 2)
    outer.current?.scale.set(outerWidth * pulse, trailLength, outerWidth * pulse)
    core.current?.position.set(side * 1.18, -0.08, -2.54 - coreLength / 2)
    core.current?.scale.set(0.09 * pulse, coreLength, 0.09 * pulse)
    if (outerMaterial.current) {
      outerMaterial.current.opacity = 0.05 + flightIntensity * 0.13 + turboIntensity * 0.24
    }
    if (coreMaterial.current) {
      coreMaterial.current.opacity = 0.16 + flightIntensity * 0.28 + turboIntensity * 0.34
    }
  })

  return (
    <>
      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.72, 1, 12, 1, true]} />
        <meshBasicMaterial
          ref={outerMaterial}
          color={hsl(accentHue, 100, 62)}
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
          side={2}
        />
      </mesh>
      <mesh ref={core} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.34, 1, 10]} />
        <meshBasicMaterial
          ref={coreMaterial}
          color={hsl((accentHue + 28) % 360, 100, 88)}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function EngineNacelle({
  side,
  primaryHue,
  accentHue,
  flightRef,
  intensityRef,
}: {
  side: number
  primaryHue: number
  accentHue: number
  flightRef: RefObject<FlightState>
  intensityRef: RefObject<number>
}) {
  const glow = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (glow.current) glow.current.opacity = 0.72 + Math.sin(clock.elapsedTime * 14 + side) * 0.16
  })

  return (
    <group>
      <mesh position={[side * 1.18, -0.08, -1.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.58, 2.55, 16, 3]} />
        <meshStandardMaterial
          color={hsl(primaryHue, 54, 30)}
          emissive={hsl(primaryHue, 66, 20)}
          emissiveIntensity={0.2}
          metalness={0.88}
          roughness={0.24}
          flatShading
        />
      </mesh>
      <mesh position={[side * 1.18, 0.01, -0.67]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.055, 8, 20]} />
        <meshStandardMaterial
          color={hsl(accentHue, 64, 45)}
          emissive={hsl(accentHue, 100, 54)}
          emissiveIntensity={0.6}
          metalness={0.75}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[side * 1.18, -0.08, -2.51]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.47, 0.105, 12, 24]} />
        <meshStandardMaterial
          color={hsl(primaryHue, 42, 24)}
          emissive={hsl(accentHue, 82, 28)}
          emissiveIntensity={0.34}
          metalness={0.92}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[side * 1.18, -0.08, -2.535]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.37, 24]} />
        <meshBasicMaterial
          ref={glow}
          color={hsl(accentHue, 100, 76)}
          transparent
          opacity={0.48}
          toneMapped={false}
        />
      </mesh>
      <EngineExhaust
        side={side}
        accentHue={accentHue}
        flightRef={flightRef}
        intensityRef={intensityRef}
      />
    </group>
  )
}

function PulsingShipLights({ accentHue }: { accentHue: number }) {
  const core = useRef<MeshBasicMaterial>(null)
  const light = useRef<PointLight>(null)

  useFrame(({ clock }) => {
    const pulse = 0.82 + Math.sin(clock.elapsedTime * 3.4) * 0.18
    if (core.current) core.current.opacity = pulse
    if (light.current) light.current.intensity = 2.8 + pulse * 1.8
  })

  return (
    <>
      <mesh position={[0, 0.36, -1.92]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.065, 10, 28]} />
        <meshBasicMaterial
          ref={core}
          color={hsl(accentHue, 100, 72)}
          transparent
          opacity={0.9}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.12, -2.2]}
        color={hsl(accentHue, 100, 70)}
        intensity={4}
        distance={6}
        decay={2}
      />
    </>
  )
}

export function ProceduralShip({
  flightRef,
  primaryHue,
  accentHue,
  quality,
  reducedMotion,
  effectsEnabled,
}: {
  flightRef: RefObject<FlightState>
  primaryHue: number
  accentHue: number
  quality: VisualQuality
  reducedMotion: boolean
  effectsEnabled: boolean
}) {
  const ship = useRef<Group>(null)
  const attitude = useRef<Group>(null)
  const turboIntensity = useRef(0)
  const turboProfile = useMemo(
    () => turboVisualProfile(quality, reducedMotion),
    [quality, reducedMotion],
  )

  useFrame((_, elapsedSeconds) => {
    const flight = flightRef.current
    ship.current?.position.set(flight.x, flight.altitude, flight.z)
    if (ship.current) ship.current.rotation.y = flight.heading
    attitude.current?.rotation.set(flight.pitch, 0, flight.bank)

    const target = isTurboVisualActive(flight, effectsEnabled)
      ? turboProfile.maximumIntensity
      : 0
    turboIntensity.current = advanceTurboVisualIntensity(
      turboIntensity.current,
      target,
      elapsedSeconds,
    )
  }, -50)

  return (
    <group ref={ship} scale={SHIP_WORLD_SCALE}>
      <group ref={attitude}>
        {/* Long faceted fuselage and reinforced reactor section. */}
        <mesh
          position={[0, 0, 0.22]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 1, 0.72]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[0.93, 5.25, 12, 4]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 66, 49)}
            emissive={hsl(primaryHue, 72, 25)}
            emissiveIntensity={0.23}
            metalness={0.76}
            roughness={0.25}
            flatShading
          />
        </mesh>
        <mesh position={[0, -0.04, -1.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.72, 0.92, 1.8, 12, 2]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 48, 27)}
            emissive={hsl(primaryHue, 62, 17)}
            emissiveIntensity={0.2}
            metalness={0.9}
            roughness={0.23}
            flatShading
          />
        </mesh>

        <SweptWing side={-1} primaryHue={primaryHue} accentHue={accentHue} />
        <SweptWing side={1} primaryHue={primaryHue} accentHue={accentHue} />

        {/* Crystal canopy over a dark recessed cockpit. */}
        <mesh position={[0, 0.34, 0.69]} scale={[0.65, 0.42, 1.18]}>
          <sphereGeometry args={[0.79, 24, 14]} />
          <meshStandardMaterial
            color={hsl((accentHue + 8) % 360, 72, 24)}
            emissive={hsl(accentHue, 94, 31)}
            emissiveIntensity={0.6}
            metalness={0.42}
            roughness={0.12}
            transparent
            opacity={0.92}
          />
        </mesh>
        <mesh position={[0, 0.54, 0.78]} scale={[0.5, 0.08, 0.94]}>
          <sphereGeometry args={[0.8, 20, 10]} />
          <meshBasicMaterial
            color={hsl(accentHue, 100, 68)}
            transparent
            opacity={0.22}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0.49, -0.18]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.82, 0.07, 0.09]} />
          <meshBasicMaterial color={hsl(accentHue, 100, 72)} toneMapped={false} />
        </mesh>

        {/* Segmented luminous dorsal energy spine. */}
        {[-1.33, -1.02, -0.71, -0.4].map((z, index) => (
          <mesh key={z} position={[0, 0.64 - index * 0.035, z]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.17, 0.075, 0.22]} />
            <meshBasicMaterial
              color={hsl((accentHue + index * 5) % 360, 100, 68 + index * 2)}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Ventral blade and layered nose armour. */}
        <mesh position={[0, -0.39, -0.82]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 0.72, 1.5]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 48, 25)}
            metalness={0.82}
            roughness={0.28}
            flatShading
          />
        </mesh>
        <mesh position={[0, -0.18, 2.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 1.12, 8, 2]} />
          <meshStandardMaterial
            color={hsl(primaryHue, 72, 59)}
            emissive={hsl(primaryHue, 64, 28)}
            emissiveIntensity={0.22}
            metalness={0.74}
            roughness={0.23}
            flatShading
          />
        </mesh>

        <EngineNacelle
          side={-1}
          primaryHue={primaryHue}
          accentHue={accentHue}
          flightRef={flightRef}
          intensityRef={turboIntensity}
        />
        <EngineNacelle
          side={1}
          primaryHue={primaryHue}
          accentHue={accentHue}
          flightRef={flightRef}
          intensityRef={turboIntensity}
        />
        <PulsingShipLights accentHue={accentHue} />
        <EngineParticles
          hue={accentHue}
          flightRef={flightRef}
          profile={turboProfile}
          intensityRef={turboIntensity}
        />
        <TurboSpeedLines
          hue={accentHue}
          profile={turboProfile}
          intensityRef={turboIntensity}
          enabled={effectsEnabled}
        />
      </group>
    </group>
  )
}
