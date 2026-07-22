import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { STAR_RADIUS } from '../../domain/celestial-interaction'
import type { StarAppearance } from '../../domain/github-system'
import { deterministicUnit, type VisualQuality } from '../../domain/visual-generation'
import {
  colorFromHsl,
  fresnelFragmentShader,
  fresnelVertexShader,
  hsl,
} from './visual-utils'

function createStarGeometry(
  appearance: StarAppearance,
  quality: VisualQuality,
): BufferGeometry {
  const source = new IcosahedronGeometry(STAR_RADIUS, quality === 'normal' ? 3 : 2)
  const geometry = source.index ? source.toNonIndexed() : source
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)

  for (let face = 0; face < positions.count / 3; face += 1) {
    const variation = deterministicUnit(appearance.facetSeed, face, 4)
    const useAccent = deterministicUnit(appearance.facetSeed, face, 9) > 0.78
    const hue = useAccent
      ? appearance.accentHue
      : appearance.primaryHue + (variation - 0.5) * 24
    const color = colorFromHsl(hue, 0.88, 0.48 + variation * 0.24)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.set([color.r, color.g, color.b], (face * 3 + vertex) * 3)
    }
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  if (geometry !== source) source.dispose()
  return geometry
}

function createActivityGeometry(appearance: StarAppearance, quality: VisualQuality) {
  const count = quality === 'normal' ? 44 : 12
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = colorFromHsl(appearance.coronaHue, 0.92, 0.67)

  for (let index = 0; index < count; index += 1) {
    const direction = new Vector3(
      deterministicUnit(appearance.facetSeed, index, 20) * 2 - 1,
      deterministicUnit(appearance.facetSeed, index, 21) * 2 - 1,
      deterministicUnit(appearance.facetSeed, index, 22) * 2 - 1,
    ).normalize()
    const radius = STAR_RADIUS * (1.08 + deterministicUnit(appearance.facetSeed, index, 23) * 0.34)
    direction.multiplyScalar(radius)
    positions.set(direction.toArray(), index * 3)
    colors.set([color.r, color.g, color.b], index * 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

function StarFlares({ appearance, quality }: { appearance: StarAppearance; quality: VisualQuality }) {
  const count = quality === 'normal' ? 10 : 4
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (!mesh.current) return
    const helper = new Object3D()
    const up = new Vector3(0, 1, 0)
    for (let index = 0; index < count; index += 1) {
      const direction = new Vector3(
        deterministicUnit(appearance.facetSeed, index, 30) * 2 - 1,
        deterministicUnit(appearance.facetSeed, index, 31) * 2 - 1,
        deterministicUnit(appearance.facetSeed, index, 32) * 2 - 1,
      ).normalize()
      const height = (0.28 + deterministicUnit(appearance.facetSeed, index, 33) * 0.48) * appearance.flareScale
      helper.position.copy(direction).multiplyScalar(STAR_RADIUS + height * 0.35)
      helper.quaternion.setFromUnitVectors(up, direction)
      helper.scale.set(0.65 + height * 0.25, height, 0.65 + height * 0.25)
      helper.updateMatrix()
      mesh.current.setMatrixAt(index, helper.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [appearance, count])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.34, 1, 4]} />
      <meshBasicMaterial
        color={hsl(appearance.coronaHue, 96, 66)}
        transparent
        opacity={0.66}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

export function ProceduralStar({
  appearance,
  quality,
  reducedMotion,
}: {
  appearance: StarAppearance
  quality: VisualQuality
  reducedMotion: boolean
}) {
  const core = useRef<Mesh>(null)
  const activity = useRef<Points>(null)
  const geometry = useMemo(
    () => createStarGeometry(appearance, quality),
    [appearance, quality],
  )
  const activityGeometry = useMemo(
    () => createActivityGeometry(appearance, quality),
    [appearance, quality],
  )
  const coronaMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: colorFromHsl(appearance.coronaHue, 0.94, 0.63) },
          uOpacity: { value: 0.46 * appearance.flareScale },
        },
        vertexShader: fresnelVertexShader,
        fragmentShader: fresnelFragmentShader,
        transparent: true,
        depthWrite: false,
        side: BackSide,
        blending: AdditiveBlending,
      }),
    [appearance],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      activityGeometry.dispose()
      coronaMaterial.dispose()
    },
    [activityGeometry, coronaMaterial, geometry],
  )

  useFrame(({ clock }, elapsedSeconds) => {
    if (core.current) {
      core.current.rotation.y += elapsedSeconds * (reducedMotion ? 0.012 : 0.045)
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 0.72) * 0.008
      core.current.scale.setScalar(pulse)
    }
    if (activity.current) {
      activity.current.rotation.y += elapsedSeconds * (reducedMotion ? 0.006 : 0.025)
    }
  })

  return (
    <group>
      <mesh ref={core} geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          emissive={hsl(appearance.primaryHue, 94, 48)}
          emissiveIntensity={1.1 * appearance.luminosity}
          roughness={0.72}
          metalness={0.02}
          flatShading
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.34} material={coronaMaterial}>
        <icosahedronGeometry args={[STAR_RADIUS, quality === 'normal' ? 3 : 2]} />
      </mesh>
      <mesh scale={1.58}>
        <icosahedronGeometry args={[STAR_RADIUS, 2]} />
        <meshBasicMaterial
          color={hsl(appearance.accentHue, 84, 58)}
          transparent
          opacity={0.045 * appearance.flareScale}
          depthWrite={false}
          side={BackSide}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <StarFlares appearance={appearance} quality={quality} />
      <points ref={activity} geometry={activityGeometry}>
        <pointsMaterial
          vertexColors
          size={quality === 'normal' ? 0.12 : 0.1}
          sizeAttenuation
          transparent
          opacity={0.72}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
