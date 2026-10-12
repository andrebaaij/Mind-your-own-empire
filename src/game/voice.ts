/**
 * The Mind's voice, using the browser's own speech synthesis: no audio files, no service. It
 * speaks each line as it appears, choosing a calm English voice when one is available.
 */

export class Voice {
  enabled = false;
  volume = 0.9;
  private chosen: SpeechSynthesisVoice | null = null;

  private get synth(): SpeechSynthesis | null {
    return typeof speechSynthesis === "undefined" ? null : speechSynthesis;
  }

  /** Prefer a natural-sounding English voice; the list loads asynchronously in some browsers. */
  private pick(): SpeechSynthesisVoice | null {
    if (this.chosen) return this.chosen;
    const voices = this.synth?.getVoices() ?? [];
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const ranked = [
      (v: SpeechSynthesisVoice) =>
        /natural|neural|premium|enhanced/i.test(v.name) && /GB|UK/i.test(v.lang + v.name),
      (v: SpeechSynthesisVoice) => /natural|neural|premium|enhanced/i.test(v.name),
      (v: SpeechSynthesisVoice) => /en-GB/i.test(v.lang),
      () => true,
    ];
    for (const test of ranked) {
      const found = english.find(test);
      if (found) {
        this.chosen = found;
        return found;
      }
    }
    return null;
  }

  /** Say a line, cutting off whatever the Mind was saying before. */
  say(text: string): void {
    const synth = this.synth;
    if (!this.enabled || !synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[‘’]/g, "'"));
    const voice = this.pick();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    utterance.pitch = 0.95;
    utterance.volume = this.volume;
    synth.speak(utterance);
  }

  stop(): void {
    this.synth?.cancel();
  }
}
