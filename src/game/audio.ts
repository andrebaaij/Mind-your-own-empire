/**
 * Lessuin's soundscape, synthesised on the fly: wind that rises and falls over the land, now
 * and then the far-off chime of something the Tessilend left ringing, and the small sounds of
 * the game itself (selecting, ordering, building, mining, warnings). No audio files.
 */

import type { GameEvent } from "./events";

/** The sounds the game makes, by name. */
export type Sound =
  | "select"
  | "order"
  | "build"
  | "mine"
  | "deliver"
  | "warning"
  | "success"
  | "info"
  | "crash"
  | "wake"
  | "land";

/** Which sound each game event makes, if any. */
export function soundFor(event: GameEvent): Sound | null {
  switch (event.kind) {
    case "selected":
      return "select";
    case "ordered":
      return "order";
    case "built":
      return "build";
    case "mined":
      return "mine";
    case "delivered":
      return "deliver";
    case "said":
      // Played when the line is shown, not when it's queued (see Hud.onDisplay).
      return null;
    case "removed":
      return event.why === "left" ? null : "crash";
    case "woke":
      return "wake";
    case "landed":
      return "land";
  }
}

export interface Volumes {
  master: number;
  ambience: number;
  effects: number;
}

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
  private ambienceBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  /** The wind's loudness, which follows how hard it's blowing. */
  private windGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volumes: Volumes = { master: 1, ambience: 1, effects: 1 };
  /** When each sound last played, so a busy base doesn't become a din. */
  private readonly lastPlayed = new Map<Sound, number>();
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
    this.master.gain.value = this.muted ? 0 : VOLUME * this.volumes.master;
    this.master.connect(context.destination);
    this.ambienceBus = context.createGain();
    this.ambienceBus.gain.value = this.volumes.ambience;
    this.ambienceBus.connect(this.master);
    this.effectsBus = context.createGain();
    this.effectsBus.gain.value = this.volumes.effects;
    this.effectsBus.connect(this.master);
    this.windGain = context.createGain();
    this.windGain.gain.value = 0.8;
    this.windGain.connect(this.ambienceBus);
    this.wind(context, this.windGain);
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
    const { context } = this;
    const master = this.ambienceBus;
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
    master.gain.setTargetAtTime(
      this.muted ? 0 : VOLUME * this.volumes.master,
      context.currentTime,
      0.3,
    );
    this.ambienceBus?.gain.setTargetAtTime(this.volumes.ambience, context.currentTime, 0.1);
    this.effectsBus?.gain.setTargetAtTime(this.volumes.effects, context.currentTime, 0.1);
    if (this.paused) void context.suspend();
    else void context.resume();
  }

  /** Let the wind be heard as hard as it blows (0.25, a breeze, to 1, a gust). */
  setWind(strength: number): void {
    if (!this.windGain || !this.context) return;
    this.windGain.gain.setTargetAtTime(0.35 + strength * 1.1, this.context.currentTime, 0.4);
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

  setVolumes(volumes: Volumes): void {
    this.volumes = { ...volumes };
    this.apply();
  }

  /** Play the sounds for the game's events since the last frame. */
  playEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      const sound = soundFor(event);
      if (sound) this.play(sound);
    }
  }

  /** Play one sound, unless it played very recently. */
  play(sound: Sound): void {
    const { context } = this;
    const out = this.effectsBus;
    if (!context || !out || this.paused || this.muted) return;
    const now = context.currentTime;
    const gap = sound === "mine" ? 0.12 : sound === "info" ? 0.4 : 0.05;
    if (now - (this.lastPlayed.get(sound) ?? -1) < gap) return;
    this.lastPlayed.set(sound, now);

    const tone = (
      type: OscillatorType,
      from: number,
      to: number,
      start: number,
      length: number,
      level: number,
    ) => {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(from, now + start);
      osc.frequency.exponentialRampToValueAtTime(to, now + start + length);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(level, now + start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(gain).connect(out);
      osc.start(now + start);
      osc.stop(now + start + length + 0.05);
    };
    const hiss = (
      filterType: BiquadFilterType,
      from: number,
      to: number,
      length: number,
      level: number,
    ) => {
      this.noise ??= this.makeNoise(context);
      const source = context.createBufferSource();
      source.buffer = this.noise;
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(from, now);
      filter.frequency.exponentialRampToValueAtTime(to, now + length);
      const gain = context.createGain();
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      source.connect(filter).connect(gain).connect(out);
      source.start(now, Math.random());
      source.stop(now + length + 0.05);
    };

    switch (sound) {
      case "select":
        tone("sine", 880, 1320, 0, 0.07, 0.05);
        break;
      case "order":
        tone("triangle", 660, 660, 0, 0.05, 0.05);
        tone("triangle", 990, 990, 0.055, 0.06, 0.05);
        break;
      case "build":
        hiss("lowpass", 900, 120, 0.25, 0.25);
        tone("sine", 160, 70, 0, 0.3, 0.15);
        tone("triangle", 520, 780, 0.12, 0.15, 0.03);
        break;
      case "mine":
        hiss("highpass", 5000, 2500, 0.03, 0.05);
        tone("square", 2200 + Math.random() * 600, 1800, 0, 0.03, 0.008);
        break;
      case "deliver":
        tone("sine", 1180, 1180, 0, 0.07, 0.035);
        tone("sine", 1770, 1770, 0.06, 0.1, 0.03);
        break;
      case "warning":
        tone("square", 440, 420, 0, 0.12, 0.025);
        tone("square", 330, 310, 0.14, 0.16, 0.025);
        break;
      case "success":
        tone("sine", 660, 660, 0, 0.25, 0.04);
        tone("sine", 990, 990, 0.1, 0.35, 0.035);
        tone("sine", 1320, 1320, 0.2, 0.5, 0.025);
        break;
      case "info":
        tone("sine", 740, 740, 0, 0.12, 0.02);
        break;
      case "crash":
        hiss("lowpass", 2400, 90, 0.6, 0.35);
        tone("sine", 120, 40, 0, 0.5, 0.15);
        break;
      case "wake":
        for (const [i, base] of [440, 554, 659, 880].entries()) {
          tone("sine", base, base * 1.5, i * 0.12, 1.2, 0.03);
        }
        hiss("bandpass", 1800, 6000, 1.4, 0.05);
        break;
      case "land":
        hiss("lowpass", 300, 60, 1.8, 0.4);
        tone("sine", 70, 45, 0, 1.6, 0.18);
        tone("sine", 523, 523, 0.6, 1.2, 0.03);
        tone("sine", 784, 784, 0.75, 1.2, 0.03);
        break;
    }
  }

  private makeNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  dispose(): void {
    window.clearTimeout(this.chimeTimer);
    void this.context?.close();
  }
}
