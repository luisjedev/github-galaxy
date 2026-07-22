import { Color } from 'three'

export const fresnelVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

export const fresnelFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vViewDirection)), 2.4);
    gl_FragColor = vec4(uColor, rim * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function hsl(hue: number, saturation: number, lightness: number): string {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function colorFromHsl(
  hue: number,
  saturation = 0.8,
  lightness = 0.7,
): Color {
  return new Color().setHSL(((hue % 360) + 360) % 360 / 360, saturation, lightness)
}
