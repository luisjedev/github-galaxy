import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  Vector3,
} from 'three'
import {
  planetOrbitPhase,
  type PlanetDescriptor,
} from '../../domain/github-system'
import type { PlanetOrbitalVisual } from '../../domain/orbital-generation'
import {
  generatePlanetVisual,
  samplePlanetSurface,
  type PlanetVisual,
  type VisualQuality,
} from '../../domain/visual-generation'
import { PlanetaryCompanions } from './OrbitalDetails'
import {
  colorFromHsl,
  fresnelFragmentShader,
  fresnelVertexShader,
  hsl,
} from './visual-utils'

function createPlanetGeometry(
  planet: PlanetDescriptor,
  quality: VisualQuality,
): BufferGeometry {
  const source = new IcosahedronGeometry(planet.radius, quality === 'normal' ? 2 : 1)
  const geometry = source.index ? source.toNonIndexed() : source
  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const center = new Vector3()

  for (let face = 0; face < positions.count / 3; face += 1) {
    center.set(0, 0, 0)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const index = face * 3 + vertex
      center.x += positions.getX(index)
      center.y += positions.getY(index)
      center.z += positions.getZ(index)
    }
    center.normalize()
    const sample = samplePlanetSurface(planet.appearance, [center.x, center.y, center.z])
    const color = colorFromHsl(sample.hue, sample.saturation / 100, sample.lightness / 100)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.set([color.r, color.g, color.b], (face * 3 + vertex) * 3)
    }
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  if (geometry !== source) source.dispose()
  return geometry
}

function SurfaceFormations({
  planet,
  visual,
}: {
  planet: PlanetDescriptor
  visual: PlanetVisual
}) {
  const mesh = useRef<InstancedMesh>(null)
  const { formations } = visual
  const isRaised = ['facets', 'ridges'].includes(planet.appearance.surfaceFeature)
  const baseColor = useMemo(
    () => colorFromHsl(planet.appearance.baseHue, 0.72, 0.42),
    [planet.appearance.baseHue],
  )
  const accentColor = useMemo(
    () => colorFromHsl(planet.appearance.accentHue, 0.84, 0.62),
    [planet.appearance.accentHue],
  )

  useLayoutEffect(() => {
    if (!mesh.current) return
    const helper = new Object3D()
    const normal = new Vector3()
    const up = new Vector3(0, 1, 0)
    const instanceColor = new Color()

    formations.forEach((formation, index) => {
      normal.set(...formation.position).normalize()
      helper.position.set(...formation.position)
      helper.quaternion.setFromUnitVectors(up, normal)
      helper.rotateY(index * 2.399)
      helper.scale.set(...formation.scale)
      helper.updateMatrix()
      mesh.current!.setMatrixAt(index, helper.matrix)
      instanceColor.copy(baseColor).lerp(accentColor, 0.35 + formation.accentMix * 0.65)
      mesh.current!.setColorAt(index, instanceColor)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [accentColor, baseColor, formations])

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, formations.length]}
      castShadow={isRaised}
      receiveShadow
    >
      {isRaised ? (
        <coneGeometry args={[1, 1, planet.appearance.surfaceFeature === 'facets' ? 4 : 5]} />
      ) : planet.appearance.surfaceFeature === 'craters' ? (
        <cylinderGeometry args={[1, 0.82, 0.3, 7]} />
      ) : (
        <dodecahedronGeometry args={[1, 0]} />
      )}
      <meshStandardMaterial
        color="white"
        emissive={hsl(planet.appearance.accentHue, 72, 28)}
        emissiveIntensity={isRaised ? visual.emissiveStrength * 0.75 : 0.02}
        roughness={planet.appearance.surfaceFeature === 'facets' ? 0.34 : 0.82}
        metalness={planet.appearance.surfaceFeature === 'facets' ? 0.28 : 0.02}
        flatShading
      />
    </instancedMesh>
  )
}

function PlanetAtmosphere({ planet, visual }: { planet: PlanetDescriptor; visual: PlanetVisual }) {
  const atmosphere = visual.atmosphere
  const material = useMemo(() => {
    if (!atmosphere) return null
    return new ShaderMaterial({
      uniforms: {
        uColor: { value: colorFromHsl(atmosphere.hue, 0.92, 0.62) },
        uOpacity: { value: atmosphere.opacity },
      },
      vertexShader: fresnelVertexShader,
      fragmentShader: fresnelFragmentShader,
      transparent: true,
      depthWrite: false,
      side: BackSide,
      blending: AdditiveBlending,
    })
  }, [atmosphere])

  useEffect(() => () => material?.dispose(), [material])
  if (!atmosphere || !material) return null

  return (
    <mesh scale={atmosphere.scale} material={material}>
      <icosahedronGeometry args={[planet.radius, 3]} />
    </mesh>
  )
}

export function OrbitingPlanet({
  planet,
  simulationElapsedSeconds,
  quality,
  orbitalVisual,
}: {
  planet: PlanetDescriptor
  simulationElapsedSeconds: RefObject<number>
  quality: VisualQuality
  orbitalVisual: PlanetOrbitalVisual
}) {
  const orbit = useRef<Group>(null)
  const planetSurface = useRef<Group>(null)
  const visual = useMemo(() => generatePlanetVisual(planet, quality), [planet, quality])
  const geometry = useMemo(() => createPlanetGeometry(planet, quality), [planet, quality])

  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => {
    if (!orbit.current || !planetSurface.current) return
    const elapsedSeconds = simulationElapsedSeconds.current
    orbit.current.rotation.y = planetOrbitPhase(planet, elapsedSeconds)
    planetSurface.current.rotation.y = planet.initialRotation + elapsedSeconds * planet.rotationSpeed
  })

  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={-1}>
        <torusGeometry args={[planet.orbitRadius, 0.012, 3, 128]} />
        <meshBasicMaterial color="#9aa6d6" transparent opacity={0.11} depthWrite={false} />
      </mesh>
      <group ref={orbit}>
        <group position={[planet.orbitRadius, 0, 0]}>
          <group ref={planetSurface}>
            <mesh geometry={geometry} castShadow receiveShadow>
              <meshStandardMaterial
                vertexColors
                emissive={hsl(planet.appearance.accentHue, 68, 26)}
                emissiveIntensity={visual.emissiveStrength}
                roughness={planet.appearance.state === 'archived' ? 0.96 : 0.7}
                metalness={planet.appearance.surfaceFeature === 'facets' ? 0.18 : 0.02}
                flatShading
              />
            </mesh>
            <SurfaceFormations planet={planet} visual={visual} />
            {visual.cloudLayer ? (
              <mesh scale={1.022}>
                <icosahedronGeometry args={[planet.radius, 2]} />
                <meshStandardMaterial
                  color={hsl(planet.appearance.accentHue, 48, 88)}
                  emissive={hsl(planet.appearance.accentHue, 60, 46)}
                  emissiveIntensity={0.16}
                  transparent
                  opacity={0.1}
                  depthWrite={false}
                  wireframe
                />
              </mesh>
            ) : null}
            <PlanetAtmosphere planet={planet} visual={visual} />
          </group>
          <PlanetaryCompanions planet={planet} visual={orbitalVisual} quality={quality} />
        </group>
      </group>
    </>
  )
}
