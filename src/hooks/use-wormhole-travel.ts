import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHubSystem } from '../domain/github-system'
import { DestinationSelectionError } from '../domain/wormhole'
import {
  GitHubRequestError,
  loadRandomGitHubSystem,
} from '../platform/github-client'
import { useFlightControls } from './use-flight-controls'

export type WormholePhase =
  | 'idle'
  | 'decision'
  | 'selecting'
  | 'entering'
  | 'tunnel'
  | 'arriving'
  | 'failed'

export type WormholeFlow =
  | { phase: 'idle' | 'decision' }
  | {
      phase: 'selecting' | 'entering' | 'tunnel'
      attempt: number
      destinationLogin?: string
    }
  | { phase: 'arriving'; attempt: number; destinationLogin: string }
  | {
      phase: 'failed'
      error: { title: string; message: string }
    }

const WORMHOLE_MINIMUM_MILLISECONDS = 1_800
const REDUCED_MOTION_WORMHOLE_MINIMUM_MILLISECONDS = 700
const WORMHOLE_ARRIVAL_MILLISECONDS = 420

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

function describeWormholeError(error: unknown): { title: string; message: string } {
  if (error instanceof DestinationSelectionError) {
    return {
      title: 'No hay una galaxia disponible ahora mismo',
      message:
        error.reason === 'none'
          ? 'GitHub Search no ha encontrado usuarios públicos que cumplan los requisitos.'
          : 'No hemos podido confirmar un destino distinto y válido tras varios intentos.',
    }
  }
  if (error instanceof GitHubRequestError) {
    if (error.kind === 'search-rate-limit' || error.kind === 'rate-limit') {
      const remainingMinutes = error.retryAt
        ? Math.max(1, Math.ceil((error.retryAt - Date.now()) / 60_000))
        : null
      return {
        title:
          error.kind === 'search-rate-limit'
            ? 'GitHub Search ha limitado el viaje'
            : 'GitHub ha limitado la carga del destino',
        message: remainingMinutes
          ? `Podrás reintentar en aproximadamente ${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'}.`
          : 'Espera unos minutos antes de volver a intentarlo.',
      }
    }
    if (error.kind === 'network') {
      return {
        title: 'Se ha perdido la conexión durante el viaje',
        message: 'El sistema de origen sigue intacto. Revisa tu conexión y vuelve a intentarlo.',
      }
    }
    if (error.kind === 'invalid-response') {
      return {
        title: 'GitHub ha devuelto datos incompletos',
        message: 'No se ha sustituido el sistema de origen. Puedes iniciar un intento nuevo.',
      }
    }
    return {
      title: 'GitHub no ha podido cargar el destino',
      message: 'La API ha respondido con un error temporal y el sistema de origen sigue disponible.',
    }
  }
  return {
    title: 'No hemos podido completar el viaje',
    message: 'El sistema de origen sigue intacto. Puedes reintentar o continuar explorándolo.',
  }
}

export function isWormholeTravelPhase(phase: WormholePhase) {
  return ['selecting', 'entering', 'tunnel', 'arriving'].includes(phase)
}

export function useWormholeTravel({
  system,
  paused,
  recentLogins,
  reducedMotion,
  systemExitRadius,
  onSystemArrival,
}: {
  system: GitHubSystem
  paused: boolean
  recentLogins: string[]
  reducedMotion: boolean
  systemExitRadius: number
  onSystemArrival: (destination: GitHubSystem) => void
}) {
  const [wormhole, setWormhole] = useState<WormholeFlow>({ phase: 'idle' })
  const wormholeAttempt = useRef(0)
  const travelInProgress = useRef(false)
  const controlsBlocked = paused || wormhole.phase !== 'idle'
  const openExitDecision = useCallback(() => {
    setWormhole((current) => current.phase === 'idle' ? { phase: 'decision' } : current)
  }, [])
  const flightControls = useFlightControls(
    system,
    controlsBlocked,
    systemExitRadius,
    openExitDecision,
  )
  const { respawn, teleportPhase } = flightControls
  const destinationLogin = 'destinationLogin' in wormhole
    ? wormhole.destinationLogin
    : undefined

  useEffect(() => () => {
    wormholeAttempt.current += 1
    travelInProgress.current = false
  }, [])

  const stayInSystem = useCallback(() => {
    wormholeAttempt.current += 1
    travelInProgress.current = false
    respawn()
    setWormhole({ phase: 'idle' })
  }, [respawn])

  const startWormholeTravel = useCallback(() => {
    if (travelInProgress.current) return
    travelInProgress.current = true
    const attempt = ++wormholeAttempt.current
    const isCurrentAttempt = () => wormholeAttempt.current === attempt
    setWormhole({ phase: 'selecting', attempt })

    window.setTimeout(() => {
      if (!isCurrentAttempt()) return
      setWormhole((current) =>
        'attempt' in current && current.attempt === attempt
          ? { ...current, phase: 'entering' }
          : current,
      )
    }, 80)
    window.setTimeout(() => {
      if (!isCurrentAttempt()) return
      setWormhole((current) =>
        'attempt' in current && current.attempt === attempt
          ? { ...current, phase: 'tunnel' }
          : current,
      )
    }, 420)

    const destinationPromise = loadRandomGitHubSystem({
      currentLogin: system.profile.login,
      recentLogins,
    })
    void destinationPromise
      .then((destination) => {
        if (!isCurrentAttempt()) return
        setWormhole((current) =>
          'attempt' in current && current.attempt === attempt
            ? { ...current, destinationLogin: destination.profile.login }
            : current,
        )
      })
      .catch(() => undefined)

    const minimumDuration = reducedMotion
      ? REDUCED_MOTION_WORMHOLE_MINIMUM_MILLISECONDS
      : WORMHOLE_MINIMUM_MILLISECONDS
    void (async () => {
      try {
        const [destination] = await Promise.all([
          destinationPromise,
          wait(minimumDuration),
        ])
        if (!isCurrentAttempt()) return
        setWormhole({
          phase: 'arriving',
          attempt,
          destinationLogin: destination.profile.login,
        })
        await wait(WORMHOLE_ARRIVAL_MILLISECONDS)
        if (!isCurrentAttempt()) return
        onSystemArrival(destination)
      } catch (error) {
        if (!isCurrentAttempt()) return
        travelInProgress.current = false
        respawn()
        setWormhole({ phase: 'failed', error: describeWormholeError(error) })
      }
    })()
  }, [onSystemArrival, recentLogins, reducedMotion, respawn, system.profile.login])

  const audioPhase = isWormholeTravelPhase(wormhole.phase)
    ? wormhole.phase === 'arriving'
      ? 'wormhole-arriving' as const
      : wormhole.phase === 'tunnel'
        ? 'wormhole-tunnel' as const
        : 'wormhole-entering' as const
    : paused
      ? 'idle' as const
      : teleportPhase

  return {
    ...flightControls,
    wormhole,
    destinationLogin,
    controlsBlocked,
    audioPhase,
    startWormholeTravel,
    stayInSystem,
  }
}
