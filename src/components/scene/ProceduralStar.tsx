import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
  Vector3,
} from 'three'
import { STAR_RADIUS } from '../../domain/celestial-interaction'
import type { StarAppearance } from '../../domain/github-system'
import { deterministicUnit, type VisualQuality } from '../../domain/visual-generation'
import { colorFromHsl, hsl } from './visual-utils'

function createStarGeometry(
  appearance: StarAppearance,
  quality: VisualQuality,
): BufferGeometry {
  const source = new IcosahedronGeometry(STAR_RADIUS, quality === 'normal' ? 4 : 3)
  const geometry = source.index ? source.toNonIndexed() : source
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)

  for (let face = 0; face < positions.count / 3; face += 1) {
    const variation = deterministicUnit(appearance.facetSeed, face, 4)
    const useAccent = deterministicUnit(appearance.facetSeed, face, 9) > 0.9
    const hue = useAccent
      ? appearance.accentHue
      : appearance.primaryHue + (variation - 0.5) * 12
    const color = colorFromHsl(
      hue,
      useAccent ? 0.96 : 0.9,
      useAccent ? 0.62 + variation * 0.16 : 0.72 + variation * 0.2,
    )
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.set([color.r, color.g, color.b], (face * 3 + vertex) * 3)
    }
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  if (geometry !== source) source.dispose()
  return geometry
}

function StarFlares({ appearance, quality }: { appearance: StarAppearance; quality: VisualQuality }) {
  const count = quality === 'normal' ? 10 : 4
  const flareUnit = STAR_RADIUS / 4
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
      helper.position.copy(direction).multiplyScalar(STAR_RADIUS + height * flareUnit * 0.35)
      helper.quaternion.setFromUnitVectors(up, direction)
      helper.scale.set(0.65 + height * 0.25, height, 0.65 + height * 0.25)
      helper.updateMatrix()
      mesh.current.setMatrixAt(index, helper.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [appearance, count, flareUnit])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.34 * flareUnit, flareUnit, 4]} />
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
  const geometry = useMemo(
    () => createStarGeometry(appearance, quality),
    [appearance, quality],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }, elapsedSeconds) => {
    if (core.current) {
      core.current.rotation.y += elapsedSeconds * (reducedMotion ? 0.012 : 0.045)
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 0.72) * 0.008
      core.current.scale.setScalar(pulse)
    }
  })

  return (
    <group>
      <mesh ref={core} geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          emissive={hsl(appearance.primaryHue - 4, 100, 56)}
          emissiveIntensity={1.1 * appearance.luminosity}
          roughness={0.72}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <StarFlares appearance={appearance} quality={quality} />
    </group>
  )
}
