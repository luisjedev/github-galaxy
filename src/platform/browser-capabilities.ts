import type { CompatibilityCapabilities } from '../domain/compatibility'

const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i

function isMobileBrowser(): boolean {
  const userAgentData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean }
  }

  return Boolean(userAgentData.userAgentData?.mobile) || MOBILE_USER_AGENT.test(navigator.userAgent)
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

export function readBrowserCapabilities(): CompatibilityCapabilities {
  return {
    isMobile: isMobileBrowser(),
    hasWebGL: supportsWebGL(),
  }
}
