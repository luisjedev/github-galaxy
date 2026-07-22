import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import type {
  ArtificialObjectVisual,
  AsteroidBeltVisual,
  InnerRockClusterVisual,
  MoonVisual,
  PlanetOrbitalVisual,
  PlanetaryRingVisual,
  RockVisual,
  ShootingStarEventVisual,
} from '../../domain/orbital-generation'
import type { PlanetDescriptor } from '../../domain/github-system'
import type { VisualQuality } from '../../domain/visual-generation'
import { colorFromHsl, hsl } from './visual-utils'

function orbitalPosition(
  visual: Pick<MoonVisual, 'ascendingNode' | 'inclination' | 'initialPhase' | 'orbitRadius' | 'orbitSpeed'>,
  elapsedSeconds: number,
  target: Vector3,
): Vector3 {
  const phase = visual.initialPhase + elapsedSeconds * visual.orbitSpeed
  const planarX = Math.cos(phase) * visual.orbitRadius
  const planarZ = Math.sin(phase) * visual.orbitRadius
  const tiltedY = -planarZ * Math.sin(visual.inclination)
  const tiltedZ = planarZ * Math.cos(visual.inclination)
  target.set(
    planarX * Math.cos(visual.ascendingNode) + tiltedZ * Math.sin(visual.ascendingNode),
    tiltedY,
    -planarX * Math.sin(visual.ascendingNode) + tiltedZ * Math.cos(visual.ascendingNode),
  )
  return target
}

function MoonInstances({ moons, detail }: { moons: MoonVisual[]; detail: 0 | 1 }) {
  const visuals = useMemo(() => moons.filter((moon) => moon.detail === detail), [detail, moons])
  const mesh = useRef<InstancedMesh>(null)
  const position = useRef(new Vector3())
  const helper = useRef(new Object3D())

  useLayoutEffect(() => {
    if (!mesh.current) return
    const instanceColor = new Color()
    visuals.forEach((moon, index) => {
      instanceColor.copy(colorFromHsl(moon.hue, moon.saturation / 100, moon.lightness / 100))
      mesh.current!.setColorAt(index, instanceColor)
    })
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [visuals])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    visuals.forEach((moon, index) => {
      orbitalPosition(moon, clock.elapsedTime, position.current)
      helper.current.position.copy(position.current)
      helper.current.rotation.set(
        moon.inclination,
        moon.initialPhase + clock.elapsedTime * moon.rotationSpeed,
        moon.ascendingNode,
      )
      helper.current.scale.setScalar(moon.radius)
      helper.current.updateMatrix()
      mesh.current!.setMatrixAt(index, helper.current.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  if (visuals.length === 0) return null
  return (
    // Instance matrices move beyond the unit geometry bounds on every frame.
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, visuals.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, detail]} />
      <meshStandardMaterial
        color="white"
        roughness={0.9}
        metalness={0.02}
        flatShading
        vertexColors
      />
    </instancedMesh>
  )
}

function PlanetaryRings({ ring }: { ring: PlanetaryRingVisual | null }) {
  if (!ring) return null
  return (
    // Render before additive ship trails and write depth so their transparent
    // pixels are composited according to distance instead of draw order.
    <group rotation={[ring.inclination, ring.ascendingNode, 0]} renderOrder={-1}>
      {ring.bands.map((band) => (
        <mesh key={`${band.radius}:${band.width}`} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[band.radius, band.width / 2, 4, 72]} />
          <meshStandardMaterial
            color={hsl(band.hue, 72, 68)}
            emissive={hsl(band.hue, 55, 30)}
            emissiveIntensity={0.16}
            transparent
            opacity={band.opacity}
            depthWrite
            side={DoubleSide}
            roughness={0.82}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

function ArtificialPartInstances({
  objects,
  part,
}: {
  objects: ArtificialObjectVisual[]
  part: 'body' | 'panel' | 'probe' | 'signal'
}) {
  const visuals = useMemo(
    () => part === 'body' || part === 'signal'
      ? objects
      : objects.filter((object) => object.kind === (part === 'panel' ? 'satellite' : 'probe')),
    [objects, part],
  )
  const mesh = useRef<InstancedMesh>(null)
  const position = useRef(new Vector3())
  const helper = useRef(new Object3D())

  useLayoutEffect(() => {
    if (!mesh.current) return
    const instanceColor = new Color()
    visuals.forEach((object, index) => {
      const hue = part === 'signal' ? object.signalHue : object.hue
      instanceColor.copy(colorFromHsl(hue, part === 'signal' ? 0.95 : 0.7, part === 'signal' ? 0.68 : 0.56))
      mesh.current!.setColorAt(index, instanceColor)
    })
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [part, visuals])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    visuals.forEach((object, index) => {
      orbitalPosition(object, clock.elapsedTime, position.current)
      helper.current.position.copy(position.current)
      helper.current.rotation.set(
        object.inclination,
        object.initialPhase + clock.elapsedTime * object.rotationSpeed,
        object.ascendingNode,
      )
      const scale = object.scale
      if (part === 'body') helper.current.scale.set(scale * 0.75, scale * 0.45, scale * 0.5)
      if (part === 'panel') helper.current.scale.set(scale * 2.6, scale * 0.09, scale * 0.72)
      if (part === 'probe') helper.current.scale.set(scale * 0.65, scale * 1.25, scale * 0.65)
      if (part === 'signal') {
        helper.current.position.y += scale * 0.9
        helper.current.scale.setScalar(scale * 0.2)
      }
      helper.current.updateMatrix()
      mesh.current!.setMatrixAt(index, helper.current.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  if (visuals.length === 0) return null
  return (
    // Orbiting instances leave the source geometry bounds after the first frame.
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, visuals.length]}
      frustumCulled={false}
    >
      {part === 'body' ? <boxGeometry args={[1, 1, 1]} /> : null}
      {part === 'panel' ? <boxGeometry args={[1, 1, 1]} /> : null}
      {part === 'probe' ? <coneGeometry args={[1, 1, 5]} /> : null}
      {part === 'signal' ? <octahedronGeometry args={[1, 0]} /> : null}
      <meshStandardMaterial
        color="white"
        vertexColors
        flatShading
        roughness={part === 'panel' ? 0.32 : 0.62}
        metalness={part === 'signal' ? 0 : 0.48}
        emissive={part === 'signal' ? '#63fff0' : '#101828'}
        emissiveIntensity={part === 'signal' ? 1.6 : 0.12}
      />
    </instancedMesh>
  )
}

export function PlanetaryCompanions({
  planet,
  visual,
  quality,
}: {
  planet: PlanetDescriptor
  visual: PlanetOrbitalVisual
  quality: VisualQuality
}) {
  return (
    <group name={`orbital-details-${planet.repository.id}`}>
      <PlanetaryRings ring={visual.ring} />
      <MoonInstances moons={visual.moons} detail={0} />
      <MoonInstances moons={visual.moons} detail={1} />
      {quality === 'normal' && visual.moons.length === 1 ? (
        <mesh
          rotation={[Math.PI / 2 + visual.moons[0].inclination, visual.moons[0].ascendingNode, 0]}
          renderOrder={-2}
        >
          <torusGeometry args={[visual.moons[0].orbitRadius, 0.006, 3, 64]} />
          <meshBasicMaterial color="#b8c1dc" transparent opacity={0.07} depthWrite={false} />
        </mesh>
      ) : null}
      <ArtificialPartInstances objects={visual.artificialObjects} part="body" />
      <ArtificialPartInstances objects={visual.artificialObjects} part="panel" />
      <ArtificialPartInstances objects={visual.artificialObjects} part="probe" />
      <ArtificialPartInstances objects={visual.artificialObjects} part="signal" />
    </group>
  )
}

function RockInstances({ rocks }: { rocks: RockVisual[] }) {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (!mesh.current) return
    const helper = new Object3D()
    const instanceColor = new Color()
    rocks.forEach((rock, index) => {
      helper.position.set(...rock.position)
      helper.rotation.set(...rock.rotation)
      helper.scale.set(...rock.scale)
      helper.updateMatrix()
      mesh.current!.setMatrixAt(index, helper.matrix)
      instanceColor.copy(colorFromHsl(rock.hue, 0.24, 0.32 + (index % 5) * 0.025))
      mesh.current!.setColorAt(index, instanceColor)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [rocks])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, rocks.length]} receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="white" vertexColors flatShading roughness={0.94} metalness={0.04} />
    </instancedMesh>
  )
}

function InnerRockCluster({ cluster }: { cluster: InnerRockClusterVisual }) {
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * cluster.driftSpeed
  })
  return (
    <group ref={group} position={cluster.center}>
      <RockInstances rocks={cluster.rocks} />
    </group>
  )
}

function AsteroidBelt({ belt }: { belt: AsteroidBeltVisual }) {
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * belt.rotationSpeed
  })
  return (
    <group ref={group}>
      <RockInstances rocks={belt.rocks} />
    </group>
  )
}

export function OrbitalRockEnvironment({
  clusters,
  belt,
}: {
  clusters: InnerRockClusterVisual[]
  belt: AsteroidBeltVisual
}) {
  return (
    <group>
      {clusters.map((cluster, index) => (
        <InnerRockCluster key={`${cluster.center.join(':')}:${index}`} cluster={cluster} />
      ))}
      <AsteroidBelt belt={belt} />
    </group>
  )
}

export function ShootingStars({
  events,
  cycleSeconds,
}: {
  events: ShootingStarEventVisual[]
  cycleSeconds: number
}) {
  const group = useRef<Group>(null)
  const pointMaterial = useRef<MeshBasicMaterial>(null)
  const trailMaterial = useRef<MeshBasicMaterial>(null)
  const start = useRef(new Vector3())
  const end = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const quaternion = useRef(new Quaternion())
  const activeEvent = useRef(-1)

  useFrame(({ clock }) => {
    if (!group.current || events.length === 0) return
    const cycleTime = clock.elapsedTime % cycleSeconds
    const index = events.findIndex(
      (event) => cycleTime >= event.startsAt && cycleTime <= event.startsAt + event.duration,
    )
    group.current.visible = index >= 0
    if (index < 0) return
    const event = events[index]
    const progress = (cycleTime - event.startsAt) / event.duration
    start.current.set(...event.start)
    end.current.set(...event.end)
    direction.current.subVectors(end.current, start.current).normalize()
    group.current.position.lerpVectors(start.current, end.current, progress)
    quaternion.current.setFromUnitVectors(up, direction.current)
    group.current.quaternion.copy(quaternion.current)
    const fade = Math.sin(progress * Math.PI) * event.opacity
    if (pointMaterial.current) pointMaterial.current.opacity = fade
    if (trailMaterial.current) trailMaterial.current.opacity = fade * 0.62
    if (activeEvent.current !== index) {
      pointMaterial.current?.color.copy(colorFromHsl(event.hue, 0.9, 0.76))
      trailMaterial.current?.color.copy(colorFromHsl(event.hue, 0.82, 0.62))
      activeEvent.current = index
    }
  })

  if (events.length === 0) return null
  return (
    <group ref={group} visible={false} renderOrder={-10}>
      <mesh>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial ref={pointMaterial} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh position={[0, -2.6, 0]}>
        <coneGeometry args={[0.12, 5.2, 4]} />
        <meshBasicMaterial ref={trailMaterial} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}
