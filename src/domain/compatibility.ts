export type Compatibility =
  | { status: 'supported' }
  | { status: 'unsupported'; reason: 'mobile' | 'webgl' }

export interface CompatibilityCapabilities {
  isMobile: boolean
  hasWebGL: boolean
}

export function evaluateCompatibility({
  isMobile,
  hasWebGL,
}: CompatibilityCapabilities): Compatibility {
  if (isMobile) {
    return { status: 'unsupported', reason: 'mobile' }
  }

  if (!hasWebGL) {
    return { status: 'unsupported', reason: 'webgl' }
  }

  return { status: 'supported' }
}
