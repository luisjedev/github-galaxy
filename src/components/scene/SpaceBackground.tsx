import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Object3D,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { FlightState } from '../../domain/flight'
import {
  advanceTurboVisualIntensity,
  isTurboVisualActive,
} from '../../domain/turbo-visual'
import type { ShootingStarEventVisual } from '../../domain/orbital-generation'
import {
  generateSpaceVisual,
  type DistantGalaxyVisual,
  type NebulaVisual,
  type SpaceVisual,
  type VisualQuality,
} from '../../domain/visual-generation'
import { ShootingStars } from './OrbitalDetails'
import { colorFromHsl } from './visual-utils'

const pointVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uTime;
  uniform float uMotion;
  uniform float uScale;

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(1.0, aSize * uScale / max(1.0, -viewPosition.z));
    vColor = color;
    vOpacity = aOpacity * (1.0 + sin(uTime * 0.72 + aPhase) * 0.055 * uMotion);
  }
`

const pointFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
    float alpha = smoothstep(0.5, 0.08, distanceFromCenter) * vOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const nebulaVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const nebulaFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  uniform float uOpacity;
  uniform float uSeed;
  uniform int uOctaves;

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(random(cell), random(cell + vec2(1.0, 0.0)), local.x),
      mix(random(cell + vec2(0.0, 1.0)), random(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int index = 0; index < 4; index++) {
      if (index >= uOctaves) break;
      value += noise(point) * amplitude;
      point = point * 2.03 + vec2(7.1, 3.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered * vec2(1.0, 1.22));
    float softEdge = smoothstep(0.5, 0.08, radius);
    float cloud = fbm(vUv * 5.0 + uSeed * 0.00001);
    float filaments = fbm(vUv * vec2(11.0, 5.0) - uSeed * 0.00002);
    float density = smoothstep(0.28, 0.88, cloud * 0.72 + filaments * 0.38) * softEdge;
    vec3 color = mix(uColor, uSecondaryColor, smoothstep(0.3, 0.78, filaments));
    float alpha = density * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const galaxyFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uOuterColor;
  uniform vec3 uCoreColor;
  uniform float uOpacity;
  uniform float uSeed;
  uniform float uArmCount;
  uniform float uSpiralMix;

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    float edge = 1.0 - smoothstep(0.48, 1.0, radius);
    float disc = exp(-radius * 3.2);
    float arms = pow(0.5 + 0.5 * cos(
      angle * uArmCount - radius * 11.0 + uSeed * 0.00001
    ), 3.0);
    float dust = 0.72 + random(floor(centered * 38.0)) * 0.4;
    float spiral = disc * mix(0.24, 1.0, arms) * dust;
    float elliptical = pow(max(0.0, 1.0 - radius), 2.5) * mix(0.82, 1.08, dust);
    float core = exp(-radius * 13.0);
    float density = mix(elliptical, spiral, uSpiralMix) * edge;
    float alpha = (density * 0.86 + core) * uOpacity;
    if (alpha < 0.006) discard;
    vec3 color = mix(uOuterColor, uCoreColor, clamp(core * 1.8, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createPointGeometry(
  points: Array<{
    position: [number, number, number]
    size: number
    hue: number
    opacity?: number
    twinklePhase?: number
  }>,
): BufferGeometry {
  const positions = new Float32Array(points.length * 3)
  const colors = new Float32Array(points.length * 3)
  const sizes = new Float32Array(points.length)
  const opacities = new Float32Array(points.length)
  const phases = new Float32Array(points.length)

  points.forEach((point, index) => {
    positions.set(point.position, index * 3)
    const color = colorFromHsl(point.hue, 0.55, 0.72)
    colors.set([color.r, color.g, color.b], index * 3)
    sizes[index] = point.size
    opacities[index] = point.opacity ?? 0.62
    phases[index] = point.twinklePhase ?? index * 0.37
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geometry.setAttribute('aOpacity', new BufferAttribute(opacities, 1))
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function usePointMaterial(scale: number, reducedMotion: boolean): ShaderMaterial {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: pointVertexShader,
        fragmentShader: pointFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uMotion: { value: reducedMotion ? 0 : 1 },
          uScale: { value: scale },
        },
      }),
    [reducedMotion, scale],
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

function Nebula({
  visual,
  quality,
}: {
  visual: NebulaVisual
  quality: VisualQuality
}) {
  const quaternion = useMemo(() => {
    const helper = new Object3D()
    helper.position.set(...visual.position)
    helper.lookAt(0, 0, 0)
    return helper.quaternion.clone().multiply(
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), visual.rotation),
    )
  }, [visual])
  const uniforms = useMemo(
    () => ({
      uColor: { value: colorFromHsl(visual.hue, 0.72, 0.5) },
      uSecondaryColor: { value: colorFromHsl(visual.secondaryHue, 0.76, 0.5) },
      uOpacity: { value: visual.opacity * 1.8 },
      uSeed: { value: visual.noiseSeed },
      uOctaves: { value: quality === 'normal' ? 4 : 2 },
    }),
    [quality, visual],
  )

  return (
    <mesh position={visual.position} scale={visual.scale} quaternion={quaternion}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        side={DoubleSide}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function DistantGalaxy({ visual }: { visual: DistantGalaxyVisual }) {
  const quaternion = useMemo(() => {
    const helper = new Object3D()
    helper.position.set(...visual.position)
    helper.lookAt(0, 0, 0)
    return helper.quaternion.clone().multiply(
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), visual.rotation),
    )
  }, [visual])
  const uniforms = useMemo(
    () => ({
      uOuterColor: { value: colorFromHsl(visual.hue, 0.58, 0.57) },
      uCoreColor: { value: colorFromHsl(visual.coreHue, 0.82, 0.72) },
      uOpacity: { value: visual.opacity },
      uSeed: { value: visual.noiseSeed },
      uArmCount: { value: visual.armCount },
      uSpiralMix: { value: visual.kind === 'spiral' ? 1 : 0 },
    }),
    [visual],
  )

  return (
    <mesh
      position={visual.position}
      scale={visual.scale}
      quaternion={quaternion}
      frustumCulled={false}
      renderOrder={-18}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={galaxyFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        side={DoubleSide}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function DeepSpace({
  visual,
  quality,
  reducedMotion,
  shootingStars,
  shootingStarCycleSeconds,
}: {
  visual: SpaceVisual
  quality: VisualQuality
  reducedMotion: boolean
  shootingStars: ShootingStarEventVisual[]
  shootingStarCycleSeconds: number
}) {
  const group = useRef<Group>(null)
  const geometry = useMemo(() => createPointGeometry(visual.stars), [visual.stars])
  const material = usePointMaterial(470, reducedMotion)
  const materialRef = useRef(material)

  useEffect(() => {
    materialRef.current = material
    return () => geometry.dispose()
  }, [geometry, material])
  useFrame(({ camera, clock }) => {
    group.current?.position.copy(camera.position)
    materialRef.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <group ref={group} renderOrder={-20}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      {visual.nebulas.map((nebula) => (
        <Nebula key={nebula.noiseSeed} visual={nebula} quality={quality} />
      ))}
      {visual.galaxies.map((galaxy) => (
        <DistantGalaxy key={galaxy.noiseSeed} visual={galaxy} />
      ))}
      {reducedMotion ? null : (
        <ShootingStars events={shootingStars} cycleSeconds={shootingStarCycleSeconds} />
      )}
    </group>
  )
}

function LocalDust({
  visual,
  flightRef,
  reducedMotion,
}: {
  visual: SpaceVisual
  flightRef: RefObject<FlightState>
  reducedMotion: boolean
}) {
  const geometry = useMemo(() => createPointGeometry(visual.dust), [visual.dust])
  const material = usePointMaterial(210, reducedMotion)
  const speeds = useMemo(() => visual.dust.map((point) => point.speed), [visual.dust])
  const geometryRef = useRef(geometry)
  const points = useRef<Points>(null)
  const turboIntensity = useRef(0)

  useEffect(() => {
    geometryRef.current = geometry
    return () => geometry.dispose()
  }, [geometry])
  useFrame((_, elapsedSeconds) => {
    const flight = flightRef.current
    if (points.current) {
      points.current.position.set(flight.x, flight.altitude, flight.z)
      points.current.rotation.set(0, flight.heading, 0)
    }
    const position = geometryRef.current.getAttribute('position') as BufferAttribute
    const motionScale = reducedMotion ? 0.28 : 1
    const targetTurbo = isTurboVisualActive(flight, true) ? (reducedMotion ? 0.45 : 1) : 0
    turboIntensity.current = advanceTurboVisualIntensity(
      turboIntensity.current,
      targetTurbo,
      elapsedSeconds,
    )
    const flightMotion =
      (Math.abs(flight.speed) * 3.2 + 0.18 + turboIntensity.current * 6.82) * motionScale
    const direction = flight.speed < 0 ? -1 : 1
    for (let index = 0; index < position.count; index += 1) {
      let nextZ = position.getZ(index) - flightMotion * speeds[index] * elapsedSeconds * direction
      if (nextZ < -22) nextZ += 30
      if (nextZ > 8) nextZ -= 30
      position.setZ(index, nextZ)
    }
    position.needsUpdate = true
  })

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-2}
    />
  )
}

export function SpaceBackground({
  seed,
  quality,
  reducedMotion,
  flightRef,
  shootingStars,
  shootingStarCycleSeconds,
}: {
  seed: number
  quality: VisualQuality
  reducedMotion: boolean
  flightRef: RefObject<FlightState>
  shootingStars: ShootingStarEventVisual[]
  shootingStarCycleSeconds: number
}) {
  const visual = useMemo(() => generateSpaceVisual(seed, quality), [quality, seed])

  return (
    <>
      <DeepSpace
        visual={visual}
        quality={quality}
        reducedMotion={reducedMotion}
        shootingStars={shootingStars}
        shootingStarCycleSeconds={shootingStarCycleSeconds}
      />
      <LocalDust visual={visual} flightRef={flightRef} reducedMotion={reducedMotion} />
    </>
  )
}
