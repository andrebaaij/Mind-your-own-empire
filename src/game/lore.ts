/**
 * The codex: what the Mind has learned about Lessuin, kept across games. The simulation calls
 * `learn` as things are found; the game passes new entries to the stored codex (codexStore.ts).
 */

export type LoreCategory =
  | "Story"
  | "Lessuin"
  | "The Tessilend"
  | "The Custody"
  | "The Idirans"
  | "Wildlife"
  | "Sites";

export const LORE_ORDER: readonly LoreCategory[] = [
  "Story",
  "Lessuin",
  "The Tessilend",
  "The Custody",
  "The Idirans",
  "Sites",
  "Wildlife",
];

export interface LoreEntry {
  id: string;
  category: LoreCategory;
  title: string;
  text: string;
}

/** Record something the Mind has learned (once). */
export function learn(state: { lore: Set<string>; newLore: LoreEntry[] }, entry: LoreEntry): void {
  if (state.lore.has(entry.id)) return;
  state.lore.add(entry.id);
  state.newLore.push(entry);
}

export const LORE = {
  bloom: {
    id: "bloom",
    category: "Lessuin",
    title: "Bloom",
    text: "The orange crystals that stud Lessuin's red ground are iron, but nobody mined them: they grew. 'Bloom' is the old smelters' word for raw iron, and the Mind borrowed it. The Custody still seeds the deposits, for manufacture that stopped ten thousand years ago.",
  },
  lattice: {
    id: "lattice",
    category: "Lessuin",
    title: "Lattice",
    text: "A green-blue crystal the Tessilend grew rather than mined, and built everything from. It still grows in seams around their sites, wherever their machines go on feeding it. It hums, very faintly, in a key the Mind doesn't recognise.",
  },
  custody: {
    id: "custody",
    category: "The Custody",
    title: "The staff",
    text: "Machines the Tessilend left to keep the world as they liked it: floating verdigris-bronze rings trailing fine manipulators, with amber working lights. Not hostile so much as house-proud. They mend, tidy and prune, and remove anything that doesn't belong. They leave alone anything attended, anything keeping watch, and anything built on the builders' foundations: built to plan.",
  },
  idirans: {
    id: "idirans",
    category: "The Idirans",
    title: "The Idirans",
    text: "Three-metre, triple-legged, armoured, and religiously certain: the Culture's enemy in the war. To an Idiran, a Mind is an abomination, a machine that presumes to think. Their skimmers sweep the ground for anything that thinks, and they are very thorough. It's practically their religion.",
  },
  epilogue: {
    id: "epilogue",
    category: "Story",
    title: "Epilogue: Only Visiting",
    text: "Eleven thousand people from Kessenthal Orbital came down on Lessuin, and the staff showed them to houses that had been kept ready for ten thousand years. The Mind stayed. 'I did say I was only visiting. I never said for how long.'",
  },
} satisfies Record<string, LoreEntry>;
