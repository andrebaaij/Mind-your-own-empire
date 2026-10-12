/**
 * Lessuin's soundscape, synthesised on the fly: wind that rises and falls over the land, and
 * now and then the far-off chime of something the Tessilend left ringing. No audio files.
 */

const MUTE_KEY = "mind-your-own-empire:muted";
const VOLUME = 0.5;

/** A pentatonic set, so chimes never clash with each other. */
const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private windows may refuse; the setting just won't be remembered.
  }
}

export class Ambience {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private chimeTimer: number | undefined;
  private paused = false;
  muted = readMuted();

  /** Browsers only allow sound after the player does something, so start on first input. */
  startOnFirstGesture(): void {
    const start = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      this.start();
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
  }

  private start(): void {
    if (this.context || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : VOLUME;
    this.master.connect(context.destination);
    this.wind(context, this.master);
    this.scheduleChime();
    this.apply();
  }

  /** Two layers of filtered noise: a low rumble and a higher whistle, each gusting slowly. */
  private wind(context: AudioContext, out: AudioNode): void {
    const seconds = 4;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-ish noise: softer than white, more like moving air.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }

    const layers = [
      { frequency: 380, q: 0.7, gain: 0.5, gust: 0.07 },
      { frequency: 1300, q: 4, gain: 0.08, gust: 0.11 },
    ];
    for (const layer of layers) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = 0.9 + Math.random() * 0.2;

      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = layer.frequency;
      filter.Q.value = layer.q;

      const gain = context.createGain();
      gain.gain.value = layer.gain;

      // Slow gusts: an oscillator sweeps the filter and the loudness.
      const gust = context.createOscillator();
      gust.frequency.value = layer.gust;
      const sweep = context.createGain();
      sweep.gain.value = layer.frequency * 0.35;
      gust.connect(sweep).connect(filter.frequency);
      const swell = context.createGain();
      swell.gain.value = layer.gain * 0.6;
      gust.connect(swell).connect(gain.gain);

      source.connect(filter).connect(gain).connect(out);
      source.start();
      gust.start();
    }
  }

  private scheduleChime(): void {
    const delay = 7_000 + Math.random() * 14_000;
    this.chimeTimer = window.setTimeout(() => {
      if (!this.paused && !this.muted) this.chime();
      this.scheduleChime();
    }, delay);
  }

  /** A soft bell: a few detuned partials, struck and left to ring out, with a long echo. */
  private chime(): void {
    const { context, master } = this;
    if (!context || !master) return;
    const now = context.currentTime;
    const note = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)] ?? 659.25;
    const notes = Math.random() < 0.4 ? [note, note * 1.5] : [note];

    const echo = context.createDelay(1);
    echo.delayTime.value = 0.42;
    const feedback = context.createGain();
    feedback.gain.value = 0.35;
    echo.connect(feedback).connect(echo);
    echo.connect(master);

    notes.forEach((frequency, n) => {
      const start = now + n * 0.35;
      for (const [ratio, level] of [
        [1, 0.05],
        [2.76, 0.015],
        [5.4, 0.006],
      ] as const) {
        const osc = context.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency * ratio;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.5 / ratio ** 0.5);
        osc.connect(gain);
        gain.connect(master);
        gain.connect(echo);
        osc.start(start);
        osc.stop(start + 4);
      }
    });
  }

  private apply(): void {
    const { context, master } = this;
    if (!context || !master) return;
    master.gain.setTargetAtTime(this.muted ? 0 : VOLUME, context.currentTime, 0.3);
    if (this.paused) void context.suspend();
    else void context.resume();
  }

  /** Quiet while the game is paused; the world isn't moving, so neither is the air. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.apply();
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    writeMuted(this.muted);
    this.apply();
    return this.muted;
  }

  dispose(): void {
    window.clearTimeout(this.chimeTimer);
    void this.context?.close();
  }
}
