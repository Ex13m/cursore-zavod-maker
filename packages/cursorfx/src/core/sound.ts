/**
 * Tiny WebAudio synth for scenario cursors — no audio assets, everything is
 * generated. Sound is opt-in (`enabled`), starts only after a user gesture
 * (browsers resume the context on first interaction).
 */
export class FxAudio {
  enabled: boolean
  private volume: number
  private ctx: AudioContext | null = null
  private noiseBuf: AudioBuffer | null = null

  constructor(enabled = false, volume = 0.5) {
    this.enabled = enabled
    this.volume = Math.max(0, Math.min(1, volume))
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuf = buf
    }
    return this.noiseBuf
  }

  /** Short percussive tone: shots, blips, glitches. */
  beep({ freq = 700, slide = -300, duration = 0.08, type = 'square' as OscillatorType, gain = 0.06 } = {}): void {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + duration)
    g.gain.setValueAtTime(gain * this.volume, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  /** Filtered noise burst: gunshots, explosions, splashes. */
  burst({ duration = 0.12, gain = 0.09, lowpass = 1400 } = {}): void {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain * this.volume, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    src.connect(filter).connect(g).connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + duration + 0.02)
  }

  // ------- continuous loop (rocket thrust) -------
  private loopSrc: AudioBufferSourceNode | null = null
  private loopGain: GainNode | null = null

  /** Set continuous rumble level 0..1 (0 stops). */
  rumble(level: number): void {
    const ctx = this.enabled ? this.ensure() : null
    if (!ctx || level <= 0.01) {
      if (this.loopSrc) {
        try { this.loopSrc.stop() } catch { /* already stopped */ }
        this.loopSrc = null
        this.loopGain = null
      }
      return
    }
    if (!this.loopSrc) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise(ctx)
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 300
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(filter).connect(g).connect(ctx.destination)
      src.start()
      this.loopSrc = src
      this.loopGain = g
    }
    if (this.loopGain) {
      this.loopGain.gain.setTargetAtTime(0.12 * level * this.volume, ctx.currentTime, 0.08)
    }
  }

  dispose(): void {
    this.rumble(0)
    void this.ctx?.close()
    this.ctx = null
    this.noiseBuf = null
  }
}
