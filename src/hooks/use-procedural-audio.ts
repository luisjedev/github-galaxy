import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ProceduralAudioEngine,
  type ReactiveAudioState,
} from '../platform/procedural-audio'

export type AudioExperienceState = 'waiting' | 'active' | 'muted' | 'unavailable'
export type FavoriteCueResult = 'ascending' | 'descending' | 'muted' | 'unavailable'

export function useProceduralAudio() {
  const engineRef = useRef<ProceduralAudioEngine | null>(null)
  const activationPromiseRef = useRef<Promise<void> | null>(null)
  const [state, setState] = useState<AudioExperienceState>('waiting')
  const stateRef = useRef<AudioExperienceState>('waiting')

  const setAudioState = useCallback((nextState: AudioExperienceState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const activate = useCallback(async () => {
    if (stateRef.current !== 'waiting') return
    if (!activationPromiseRef.current) {
      activationPromiseRef.current = (async () => {
        try {
          const engine = engineRef.current ?? new ProceduralAudioEngine()
          engineRef.current = engine
          await engine.activate()
          engine.setMuted(false)
          setAudioState('active')
        } catch {
          setAudioState('unavailable')
        }
      })()
    }
    await activationPromiseRef.current
  }, [setAudioState])

  useEffect(() => {
    if (state !== 'waiting') return

    const activateFromFirstInteraction = (event: Event) => {
      // The dedicated control keeps its normal click semantics while every
      // other interaction enables sound automatically.
      if (
        event.type === 'pointerdown' &&
        event.target instanceof Element &&
        event.target.closest('.audio-control')
      ) {
        return
      }
      void activate()
    }
    window.addEventListener('pointerdown', activateFromFirstInteraction, { once: true })
    window.addEventListener('keydown', activateFromFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', activateFromFirstInteraction)
      window.removeEventListener('keydown', activateFromFirstInteraction)
    }
  }, [activate, state])

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
    const engine = engineRef.current ?? new ProceduralAudioEngine()
    engineRef.current = engine
    engine.update(reactiveState)
  }, [])

  const playFavoriteCue = useCallback(async (
    action: 'added' | 'removed',
  ): Promise<FavoriteCueResult> => {
    if (stateRef.current === 'waiting') await activate()
    if (stateRef.current === 'muted') return 'muted'
    if (stateRef.current !== 'active') return 'unavailable'
    return engineRef.current?.playFavoriteCue(action)
      ? action === 'added' ? 'ascending' : 'descending'
      : 'unavailable'
  }, [activate])

  const cancelFavoriteCues = useCallback(() => {
    engineRef.current?.stopFavoriteCues()
  }, [])

  useEffect(
    () => () => {
      void engineRef.current?.dispose()
    },
    [],
  )

  return { state, activate, toggleMuted, update, playFavoriteCue, cancelFavoriteCues }
}
