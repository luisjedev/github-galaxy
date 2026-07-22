export type TeleportAudioPhase = 'idle' | 'charging' | 'jump'

export interface ReactiveAudioState {
  speed: number
  turbo: boolean
  proximity: boolean
  paused: boolean
  teleportPhase: TeleportAudioPhase
}

type AudioContextConstructor = new () => AudioContext

function audioContextConstructor(): AudioContextConstructor | null {
  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor
  }
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function smoothlySet(parameter: AudioParam, value: number, time: number) {
  parameter.cancelScheduledValues(time)
  parameter.setTargetAtTime(value, time, 0.045)
}

function connectOscillator(
  context: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  frequency: number,
) {
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.value = frequency
  oscillator.connect(destination)
  oscillator.start()
  return oscillator
}

/**
 * A small, entirely synthesized soundtrack. The graph is created lazily so merely
 * loading a shared URL never attempts playback before a visitor interaction.
 */
export class ProceduralAudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineOscillator: OscillatorNode | null = null
  private turboGain: GainNode | null = null
  private proximityGain: GainNode | null = null
  private teleportGain: GainNode | null = null
  private teleportOscillator: OscillatorNode | null = null
  private muted = false
  private teleportPhase: TeleportAudioPhase = 'idle'

  async activate(): Promise<void> {
    if (!this.context) this.createGraph()
    if (!this.context) throw new Error('Web Audio is unavailable')
    await this.context.resume()
    this.applyMasterLevel()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.applyMasterLevel()
  }

  update(state: ReactiveAudioState) {
    const context = this.context
    if (!context || !this.engineGain || !this.engineOscillator || !this.turboGain || !this.proximityGain) {
      return
    }

    const now = context.currentTime
    const movement = Math.min(1, Math.abs(state.speed) / 4)
    const shouldPlayReactiveAudio = !state.paused && state.teleportPhase === 'idle'
    smoothlySet(this.engineGain.gain, shouldPlayReactiveAudio ? 0.018 + movement * 0.055 : 0, now)
    smoothlySet(this.engineOscillator.frequency, 62 + movement * 94, now)
    smoothlySet(this.turboGain.gain, shouldPlayReactiveAudio && state.turbo ? 0.055 : 0, now)
    // Kept deliberately quiet so the information card remains the primary proximity signal.
    smoothlySet(this.proximityGain.gain, shouldPlayReactiveAudio && state.proximity ? 0.016 : 0, now)

    if (state.teleportPhase !== this.teleportPhase) {
      this.setTeleportPhase(state.teleportPhase)
    }
  }

  private createGraph() {
    const AudioContextClass = audioContextConstructor()
    if (!AudioContextClass) throw new Error('Web Audio is unavailable')

    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = 0
    master.connect(context.destination)

    const ambientGain = context.createGain()
    ambientGain.gain.value = 0.025
    ambientGain.connect(master)
    connectOscillator(context, ambientGain, 'sine', 55)
    connectOscillator(context, ambientGain, 'sine', 82.41)
    const ambientFifth = connectOscillator(context, ambientGain, 'triangle', 123.47)
    ambientFifth.detune.value = -7

    const engineGain = context.createGain()
    engineGain.gain.value = 0
    const engineFilter = context.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 420
    engineFilter.Q.value = 1.4
    engineGain.connect(engineFilter)
    engineFilter.connect(master)
    const engineOscillator = connectOscillator(context, engineGain, 'sawtooth', 62)

    const turboGain = context.createGain()
    turboGain.gain.value = 0
    const turboFilter = context.createBiquadFilter()
    turboFilter.type = 'bandpass'
    turboFilter.frequency.value = 760
    turboFilter.Q.value = 0.8
    turboGain.connect(turboFilter)
    turboFilter.connect(master)
    connectOscillator(context, turboGain, 'square', 118)

    const proximityGain = context.createGain()
    proximityGain.gain.value = 0
    proximityGain.connect(master)
    const proximityPulseGain = context.createGain()
    proximityPulseGain.gain.value = 0.65
    proximityPulseGain.connect(proximityGain)
    connectOscillator(context, proximityPulseGain, 'sine', 523.25)
    const proximityPulse = context.createOscillator()
    const proximityPulseDepth = context.createGain()
    proximityPulse.type = 'sine'
    proximityPulse.frequency.value = 1.6
    proximityPulseDepth.gain.value = 0.3
    proximityPulse.connect(proximityPulseDepth)
    proximityPulseDepth.connect(proximityPulseGain.gain)
    proximityPulse.start()

    const teleportGain = context.createGain()
    teleportGain.gain.value = 0
    teleportGain.connect(master)
    const teleportOscillator = connectOscillator(context, teleportGain, 'sine', 90)

    this.context = context
    this.masterGain = master
    this.engineGain = engineGain
    this.engineOscillator = engineOscillator
    this.turboGain = turboGain
    this.proximityGain = proximityGain
    this.teleportGain = teleportGain
    this.teleportOscillator = teleportOscillator
  }

  private applyMasterLevel() {
    if (!this.context || !this.masterGain) return
    smoothlySet(this.masterGain.gain, this.muted ? 0 : 0.72, this.context.currentTime)
  }

  private setTeleportPhase(phase: TeleportAudioPhase) {
    const context = this.context
    const gain = this.teleportGain
    const oscillator = this.teleportOscillator
    this.teleportPhase = phase
    if (!context || !gain || !oscillator) return

    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)
    oscillator.frequency.cancelScheduledValues(now)

    if (phase === 'charging') {
      gain.gain.setValueAtTime(0.015, now)
      gain.gain.linearRampToValueAtTime(0.12, now + 0.9)
      oscillator.frequency.setValueAtTime(90, now)
      oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.9)
      return
    }

    if (phase === 'jump') {
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
      oscillator.frequency.setValueAtTime(520, now)
      oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.42)
      this.playProceduralJumpNoise(now)
      return
    }

    smoothlySet(gain.gain, 0, now)
  }

  private playProceduralJumpNoise(time: number) {
    if (!this.context || !this.masterGain) return
    const sampleRate = this.context.sampleRate || 44_100
    const frameCount = Math.floor(sampleRate * 0.36)
    const buffer = this.context.createBuffer(1, frameCount, sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 0x6d2b79f5
    for (let index = 0; index < samples.length; index += 1) {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      const noise = (((seed ^ (seed >>> 14)) >>> 0) / 4_294_967_296) * 2 - 1
      samples[index] = noise * (1 - index / samples.length)
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    gain.gain.value = 0.11
    source.buffer = buffer
    source.connect(gain)
    gain.connect(this.masterGain)
    source.start(time)
  }
}
