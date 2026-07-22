import {
  selectVisualQuality,
  type VisualQuality,
} from '../domain/visual-generation'

export interface VisualSettings {
  quality: VisualQuality
  reducedMotion: boolean
  dpr: [number, number]
}

function usesSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!context) return true
    const rendererInfo = context.getExtension('WEBGL_debug_renderer_info')
    const renderer = rendererInfo
      ? String(context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER))
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return /swiftshader|llvmpipe|software/i.test(renderer)
  } catch {
    return true
  }
}

export function readVisualSettings(): VisualSettings {
  const quality = selectVisualQuality({
    hardwareConcurrency: navigator.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio,
    softwareRenderer: usesSoftwareRenderer(),
  })
  return {
    quality,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    dpr: quality === 'normal' ? [1, Math.min(1.6, window.devicePixelRatio)] : [1, 1.15],
  }
}
