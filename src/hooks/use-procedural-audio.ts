import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ProceduralAudioEngine,
  type ReactiveAudioState,
} from '../platform/procedural-audio'

export type AudioExperienceState = 'waiting' | 'active' | 'muted' | 'unavailable'

export function useProceduralAudio() {
  const engineRef = useRef<ProceduralAudioEngine | null>(null)
  const [state, setState] = useState<AudioExperienceState>('waiting')
  const stateRef = useRef<AudioExperienceState>('waiting')

  const setAudioState = useCallback((nextState: AudioExperienceState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const activate = useCallback(async () => {
    if (
      stateRef.current === 'active' ||
      stateRef.current === 'muted' ||
      stateRef.current === 'unavailable'
    ) {
      return
    }

    try {
      const engine = engineRef.current ?? new ProceduralAudioEngine()
      engineRef.current = engine
      await engine.activate()
      engine.setMuted(false)
      setAudioState('active')
    } catch {
      setAudioState('unavailable')
    }
  }, [setAudioState])

  const toggleMuted = useCallback(() => {
    if (stateRef.current === 'waiting') {
      void activate()
      return
    }
    if (stateRef.current === 'unavailable') return

    const shouldMute = stateRef.current === 'active'
    engineRef.current?.setMuted(shouldMute)
    setAudioState(shouldMute ? 'muted' : 'active')
  }, [activate, setAudioState])

  const update = useCallback((reactiveState: ReactiveAudioState) => {
    engineRef.current?.update(reactiveState)
  }, [])

  useEffect(
    () => () => {
      engineRef.current?.update({
        speed: 0,
        turbo: false,
        proximity: false,
        paused: true,
        teleportPhase: 'idle',
      })
    },
    [],
  )

  return { state, activate, toggleMuted, update }
}
