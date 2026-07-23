import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  IcosahedronGeometry,
  Mesh,
  ShaderMaterial,
  Sprite,
} from 'three'
import { STAR_RADIUS } from '../../domain/celestial-interaction'
import type { StarAppearance } from '../../domain/github-system'
import type { VisualQuality } from '../../domain/visual-generation'
import { colorFromHsl, hsl } from './visual-utils'

const solarVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPosition = normalize(position);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const solarFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uDeepColor;
  uniform vec3 uSurfaceColor;
  uniform vec3 uHotColor;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 flow = vec3(uTime * 0.025, -uTime * 0.014, uTime * 0.009);
    vec3 seededPosition = vPosition + vec3(uSeed * 0.000013);

    // Large convection currents with a finer, bright granular layer.
    float convection = fbm(seededPosition * 3.2 + flow);
    float granules = noise(seededPosition * 19.0 - flow * 2.6);
    float filaments = fbm(seededPosition * 8.0 + flow * 1.8);
    // Blend the smallest details to avoid harsh, pixel-like transitions at a distance.
    float grainWidth = max(fwidth(granules) * 1.8, 0.025);
    float smoothGranules = smoothstep(0.34 - grainWidth, 0.72 + grainWidth, granules);
    float heat = clamp(convection * 0.72 + smoothGranules * 0.2 + filaments * 0.18, 0.0, 1.0);

    // Stable, irregular darker magnetic regions resembling sunspots.
    float magneticField = fbm(seededPosition * 1.65 + vec3(uSeed * 0.0007));
    float spotDetail = fbm(seededPosition * 8.0 - flow * 0.3);
    float sunspot = smoothstep(0.69, 0.79, magneticField) * smoothstep(0.42, 0.7, spotDetail);

    vec3 color = mix(uDeepColor, uSurfaceColor, smoothstep(0.2, 0.75, heat));
    color = mix(color, uHotColor, smoothstep(0.68, 0.96, heat));
    color *= 1.0 - sunspot * 0.62;

    float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
    float limbDarkening = 0.58 + 0.42 * pow(facing, 0.42);
    float rimHeat = pow(1.0 - facing, 3.0) * 0.28;
    color = color * limbDarkening + uDeepColor * rimHeat;

    gl_FragColor = vec4(color * 1.22, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createHaloTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  const textureSize = 1024
  const center = textureSize / 2
  canvas.width = textureSize
  canvas.height = textureSize
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(
    center,
    center,
    textureSize * 0.195,
    center,
    center,
    center,
  )
  gradient.addColorStop(0, 'rgba(255, 244, 175, 0)')
  gradient.addColorStop(0.31, 'rgba(255, 225, 102, 0)')
  gradient.addColorStop(0.39, 'rgba(255, 190, 45, 0.34)')
  gradient.addColorStop(0.53, 'rgba(255, 125, 18, 0.14)')
  gradient.addColorStop(0.72, 'rgba(255, 90, 10, 0.045)')
  gradient.addColorStop(1, 'rgba(255, 70, 0, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, textureSize, textureSize)
  return new CanvasTexture(canvas)
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
  const surfaceMaterial = useRef<ShaderMaterial>(null)
  const halo = useRef<Sprite>(null)
  const geometry = useMemo(
    () => new IcosahedronGeometry(STAR_RADIUS, quality === 'normal' ? 6 : 4),
    [quality],
  )
  const haloTexture = useMemo(() => createHaloTexture(), [])

  const surfaceUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSeed: { value: appearance.facetSeed % 100_000 },
    uDeepColor: { value: colorFromHsl(appearance.accentHue - 4, 1, 0.42) },
    uSurfaceColor: { value: colorFromHsl(appearance.primaryHue, 1, 0.58) },
    uHotColor: { value: colorFromHsl(appearance.coronaHue + 7, 1, 0.86) },
  }), [appearance])
  useEffect(() => () => {
    geometry.dispose()
    haloTexture.dispose()
  }, [geometry, haloTexture])

  useFrame(({ clock }, elapsedSeconds) => {
    const time = reducedMotion ? 0 : clock.elapsedTime
    if (surfaceMaterial.current) surfaceMaterial.current.uniforms.uTime.value = time
    if (core.current) {
      core.current.rotation.y += elapsedSeconds * (reducedMotion ? 0.006 : 0.022)
      core.current.rotation.x = Math.sin(time * 0.045) * 0.025
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.7) * 0.004
      core.current.scale.setScalar(pulse)
    }
    if (halo.current && !reducedMotion) {
      const haloPulse = 1 + Math.sin(time * 0.43) * 0.018
      halo.current.scale.set(25 * haloPulse, 25 * haloPulse, 1)
    }
  })

  return (
    <group>
      <sprite ref={halo} scale={[25, 25, 1]} renderOrder={-1}>
        <spriteMaterial
          map={haloTexture}
          color={hsl(appearance.coronaHue, 100, 72)}
          transparent
          opacity={0.82}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      <mesh ref={core} geometry={geometry}>
        <shaderMaterial
          ref={surfaceMaterial}
          uniforms={surfaceUniforms}
          vertexShader={solarVertexShader}
          fragmentShader={solarFragmentShader}
          toneMapped={false}
        />
      </mesh>

    </group>
  )
}
