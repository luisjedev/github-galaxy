import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectAtmosphereContact,
  resolveAtmosphereCollision,
  selectActiveCelestialBody,
  type ActiveCelestialBody,
  type AtmosphereContact,
} from '../domain/celestial-interaction'
import {
  advanceFlight,
  createInitialFlight,
  createStarReturnFlight,
  idleFlightInput,
  type FlightInput,
  type FlightState,
} from '../domain/flight'
import type { GitHubSystem } from '../domain/github-system'

export type TeleportPhase = 'idle' | 'charging' | 'jump'

const TELEPORT_CHARGE_MILLISECONDS = 900
const TELEPORT_JUMP_MILLISECONDS = 450

const flightKeyByKeyboardKey: Record<string, keyof FlightInput> = {
  w: 'forward',
  s: 'reverse',
  a: 'left',
  d: 'right',
  j: 'descend',
  k: 'ascend',
  ' ': 'turbo',
}

function updateFlightInput(
  input: FlightInput,
  event: Pick<globalThis.KeyboardEvent, 'key' | 'preventDefault'>,
  pressed: boolean,
) {
  const flightKey = flightKeyByKeyboardKey[event.key.toLowerCase()]
  if (!flightKey) return
  if (flightKey === 'turbo') event.preventDefault()
  input[flightKey] = pressed
}

export function useFlightControls(system: GitHubSystem, paused: boolean) {
  const initialFlight = useState(() => createInitialFlight(system))[0]
  const initialFrameTime = useState(() => performance.now())[0]
  const [flight, setFlight] = useState(initialFlight.state)
  const flightState = useRef<FlightState>(initialFlight.state)
  const previousFrameTime = useRef(initialFrameTime)
  const simulationElapsedSeconds = useRef(0)
  const initialActiveBody = useState(() =>
    selectActiveCelestialBody(system, initialFlight.state, 0),
  )[0]
  const [activeBody, setActiveBody] = useState<ActiveCelestialBody | null>(initialActiveBody)
  const activeBodyRef = useRef<ActiveCelestialBody | null>(initialActiveBody)
  const [atmosphereContact, setAtmosphereContact] = useState<AtmosphereContact | null>(null)
  const atmosphereContactRef = useRef<AtmosphereContact | null>(null)
  const flightInput = useRef<FlightInput>({ ...idleFlightInput })
  const teleportState = useRef<{ phase: TeleportPhase; startedAt: number }>({
    phase: 'idle',
    startedAt: 0,
  })
  const [teleportPhase, setTeleportPhase] = useState<TeleportPhase>('idle')
  const experienceRef = useRef<HTMLElement>(null)

  useEffect(() => {
    flightInput.current = { ...idleFlightInput }
    previousFrameTime.current = performance.now()
    if (!paused) experienceRef.current?.focus({ preventScroll: true })
  }, [paused])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (paused || !experienceRef.current?.contains(document.activeElement)) return
      const key = event.key.toLowerCase()
      if (key === 'r') {
        event.preventDefault()
        if (event.repeat || teleportState.current.phase !== 'idle') return
        flightInput.current = { ...idleFlightInput }
        teleportState.current = { phase: 'charging', startedAt: performance.now() }
        setTeleportPhase('charging')
        return
      }
      if (teleportState.current.phase !== 'idle') return
      if (key === 'e' && !event.repeat) {
        const destination =
          activeBodyRef.current?.kind === 'planet'
            ? activeBodyRef.current.planet.repository.html_url
            : activeBodyRef.current?.kind === 'star'
              ? system.profile.html_url
              : null
        if (destination) {
          event.preventDefault()
          window.open(destination, '_blank', 'noopener,noreferrer')
        }
        return
      }
      updateFlightInput(flightInput.current, event, true)
    }
    const handleKeyUp = (event: globalThis.KeyboardEvent) =>
      updateFlightInput(flightInput.current, event, false)
    const handleWindowBlur = () => {
      flightInput.current = { ...idleFlightInput }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [paused, system])

  const advanceFlightFrame = useCallback((time: number) => {
    const previousTime = previousFrameTime.current
    if (paused) {
      previousFrameTime.current = time
      return
    }

    const teleport = teleportState.current
    if (teleport.phase === 'charging') {
      previousFrameTime.current = time
      if (time - teleport.startedAt >= TELEPORT_CHARGE_MILLISECONDS) {
        teleportState.current = { phase: 'jump', startedAt: time }
        setTeleportPhase('jump')
      }
      return
    }
    if (teleport.phase === 'jump') {
      previousFrameTime.current = time
      if (time - teleport.startedAt < TELEPORT_JUMP_MILLISECONDS) return

      const returnedFlight = createStarReturnFlight()
      teleportState.current = { phase: 'idle', startedAt: 0 }
      flightInput.current = { ...idleFlightInput }
      flightState.current = returnedFlight
      setFlight(returnedFlight)
      setTeleportPhase('idle')
      atmosphereContactRef.current = null
      setAtmosphereContact(null)
      const returnedActiveBody = selectActiveCelestialBody(
        system,
        returnedFlight,
        simulationElapsedSeconds.current,
      )
      activeBodyRef.current = returnedActiveBody
      setActiveBody(returnedActiveBody)
      return
    }

    const frameSeconds = (time - previousTime) / 1_000
    const previousElapsedSeconds = simulationElapsedSeconds.current
    const elapsedSeconds = previousElapsedSeconds + frameSeconds
    previousFrameTime.current = time
    simulationElapsedSeconds.current = elapsedSeconds
    const current = flightState.current
    const input = flightInput.current
    const hasInput = Object.values(input).some(Boolean)
    const proposedFlight =
      !hasInput &&
      current.speed === 0 &&
      current.bank === 0 &&
      current.pitch === 0 &&
      !current.turbo
        ? current
        : advanceFlight(current, input, frameSeconds)
    const collision = resolveAtmosphereCollision(
      system,
      current,
      proposedFlight,
      previousElapsedSeconds,
      elapsedSeconds,
    )
    const nextFlight = collision.flight

    if (nextFlight !== current) {
      flightState.current = nextFlight
      setFlight(nextFlight)
    }

    const nextContact =
      collision.contact ?? detectAtmosphereContact(system, nextFlight, elapsedSeconds)
    if (nextContact?.key !== atmosphereContactRef.current?.key) {
      atmosphereContactRef.current = nextContact
      setAtmosphereContact(nextContact)
    }

    const nextActiveBody = selectActiveCelestialBody(system, nextFlight, elapsedSeconds)
    if (nextActiveBody?.key !== activeBodyRef.current?.key) {
      activeBodyRef.current = nextActiveBody
      setActiveBody(nextActiveBody)
    }
  }, [paused, system])

  return {
    experienceRef,
    flight,
    flightState,
    advanceFlightFrame,
    initialFlight,
    activeBody,
    atmosphereContact,
    simulationElapsedSeconds,
    teleportPhase,
  }
}
