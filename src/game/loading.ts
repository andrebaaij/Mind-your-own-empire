/**
 * The loading screen: what the player looks at while the world is charted and the GPU gets its
 * shaders ready, so that the first frame they see is a smooth one. The screen itself is in
 * game.html, styled inline, so it's there before any script has loaded; this fills it in,
 * moves the bar along, and fades it out.
 */

const TIPS = [
  "Right-click a Tessilend site with drones selected to study it. The Custody prefers you didn't.",
  "Press R to run silent: slower drones, smaller signature, fewer awkward questions.",
  "Groves hide drones from skimmers. The groves have not been asked how they feel about this.",
  "Wardens tidy whatever is left unattended. Including, on occasion, you.",
  "Bloom is iron the Tessilend grew rather than mined. They did not hold with mines.",
  "Lattice comes from the seams around Tessilend sites. The sites notice.",
  "Ctrl and a number keeps a group of drones. Shift and the number gets them back.",
  "Decoys draw skimmers away. Skimmers are not stupid, but they are thorough.",
  "Press . to find idle drones. Esc skips a fly-over.",
  "The minimap turns with the camera. Right-click it to send the selection somewhere.",
  "The Mind saves every two minutes. Minds are like that.",
  "Suspicion fades if you give it time. So does most of the Idirans' patience.",
  "The wind always blows on Lessuin. The arrow on the minimap says where to.",
  "Far out, the land turns to dune seas, ash, salt and green basins. Sinkholes hide gardens.",
];

const STEPS = [
  "Charting Lessuin",
  "Waking the renderer",
  "Unpacking the drones",
  "Compiling shaders",
  "Growing the grass",
  "Briefing the drones",
] as const;
export type LoadingStep = (typeof STEPS)[number];

export class LoadingScreen {
  private readonly root: HTMLElement | null;
  private readonly bar: HTMLElement | null;
  private readonly step: HTMLElement | null;
  private readonly tip: HTMLElement | null;
  private shown = 0;
  private target = 0;
  private tipIndex = Math.floor(Math.random() * TIPS.length);
  private readonly tipTimer: number;
  private frame = 0;

  constructor(title: { kicker: string; title: string }) {
    this.root = document.getElementById("loading");
    this.bar = this.root?.querySelector<HTMLElement>(".loading-bar span") ?? null;
    this.step = this.root?.querySelector<HTMLElement>(".loading-step") ?? null;
    this.tip = this.root?.querySelector<HTMLElement>(".loading-tip") ?? null;
    const kicker = this.root?.querySelector(".loading-kicker");
    const heading = this.root?.querySelector(".loading-title");
    if (kicker) kicker.textContent = title.kicker;
    if (heading) heading.textContent = title.title;
    this.showTip();
    this.tipTimer = window.setInterval(() => {
      this.tipIndex++;
      this.showTip();
    }, 6_000);
    // The bar eases towards where loading has got to, rather than jumping.
    const animate = () => {
      this.shown += (this.target - this.shown) * 0.12;
      if (this.bar) this.bar.style.transform = `scaleX(${this.shown.toFixed(4)})`;
      this.frame = requestAnimationFrame(animate);
    };
    this.frame = requestAnimationFrame(animate);
  }

  private showTip(): void {
    if (!this.tip) return;
    this.tip.textContent = TIPS[this.tipIndex % TIPS.length] ?? "";
  }

  /** Say what's being done now, and how far along the whole load is (0 to 1). */
  progress(step: LoadingStep, fraction: number): void {
    if (this.step) this.step.textContent = `${step}…`;
    this.target = Math.max(this.target, Math.min(1, fraction));
  }

  /** Fill the bar, fade the screen out, and take it away. */
  async finish(): Promise<void> {
    this.target = 1;
    window.clearInterval(this.tipTimer);
    if (!this.root) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
    this.root.classList.add("done");
    await new Promise((resolve) => setTimeout(resolve, 700));
    cancelAnimationFrame(this.frame);
    this.root.remove();
  }
}

/** Let the page draw (the bar, the step) before going on with something slow. */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
