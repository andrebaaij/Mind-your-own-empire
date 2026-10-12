# Art direction: Lessuin

The look of *Mind your own Empire*, and the brief for every 3D asset generated for it. The
reference images in `reference/` were made with an image model from the prompts in
`prompts.py`; use them as the input images for image-to-3D (one object per image, 3/4 view,
plain background), and as the target look when judging results.

## Pillars

1. **Vast, quiet, gently absurd.** An empty, beautiful world kept immaculate for nobody.
   Melancholy with dry wit; never grimdark, never cute.
2. **Painterly realism, readable from above.** Stylized-real proportions, chunky silhouettes
   that read at RTS zoom, hand-painted PBR surfaces. Detail lives in the material, not in
   greebles.
3. **Three design languages that can't be confused**, each with its own light colour: the
   Culture glows cyan, the Custody amber, the Idirans red. The Tessilend glow teal.
4. **Warm land, cool light.** Rust and ochre ground under a lilac sky, with the gas giant
   always somewhere overhead.

## Palette

| Role | Colour | Hex |
| --- | --- | --- |
| Ground: rust dirt | rust red | `#8a3b2a` |
| Ground: sand | ochre | `#c4965f` |
| Shadow | deep plum | `#3a1d2b` |
| Sky | hazy lilac | `#a8a0c8` |
| Gas giant | peach / plum bands | `#f3b98d` / `#6b3a52` |
| Bloom (iron) | orange crystal | `#ffab5e` |
| Lattice | teal-green crystal | `#7ff0cc` |
| Acid pools | acid green | `#5cd246` |
| Culture light (player, default) | cyan | `#5fe0ff` |
| Custody light | amber | `#ffb347` |
| Idiran light | signal red | `#ff4a2a` |

The player's aura colour can change (the menu offers several); Culture models should keep their
glow in a separate emissive mask so it can be tinted at runtime.

## Design languages

**The Culture (player).** Seamless, softly bevelled forms in matte graphite and warm ceramic
white. No bolts, panels or exhaust. Nothing touches the ground: everything floats on soft cyan
aura fields. Elegant and slightly smug. *Mind core, worker drone, scout, solar array, sensor
spire, decoy, landing pad.*

**The Custody.** Caretaker machines of a civilisation that Sublimed: floating rings and lenses
of aged verdigris bronze, engraved with the builders' patterns, trailing fine manipulator
filaments, with amber working lights. Ornate but practical; house-proud. *Wardens.*

**The Idirans.** Heavy, angular, faceted gunmetal and oxblood armour with triple symmetry and
harsh red lights. Brutal, religious, utilitarian, scuffed. Idirans themselves are three-metre,
three-legged, armoured beings with heavy beaked heads: never humanoid. *Skimmers, forward
camps.*

**The Tessilend.** Buildings grown, not built: pale bone-white crystalline lattice, slender
organic arches and columns with hexagonal facets, faint teal light in the seams, sand-scoured.
*Ruins, relic sites, the transmitter, paving.*

**Lessuin's life.** Dark plum umbrella-canopied grove trees with pale twisted trunks, lantern
plants with warm glowing bulbs, glowing bulb fungi, dry rust shrubs, pale ochre grass.
Trundlers (six-legged armoured grazers), kites (manta-winged gliders), longshanks (enormous
four-legged striders).

## 3D asset spec

- **Scale**: 1 game tile = 1 metre. A worker drone is about 0.6 tiles long; buildings fill their
  footprint (the Mind core, landing pad and Idiran camp 3×3; solar, spire, decoy 1×1); a longshank stands about 8 tiles tall.
- **Orientation**: +Y up, facing +Z, pivot at the centre of the footprint on the ground (for
  floating units, on the ground under them; hover height is set in the game).
- **Format**: glTF binary (`.glb`), PBR metallic-roughness, textures at 1024² (512² for small
  props), emissive in its own texture so it can be tinted and bloomed.
- **Budget**: units 2–5k triangles, buildings 5–12k, props 0.5–2k, the Mind core 15k.
- **Lighting**: don't bake lighting or shadows into albedo; the game lights everything.

## Prompting

Every prompt starts from one of the style blocks in `prompts.py`: `SCENE` for environments,
`ASSET` for single objects, `SHEET` for rows of objects. Then the faction's language block,
then the object. Keep "no text, no labels" in every prompt: the model likes to caption sheets.

To make more: `cd art && python3 batch.py <name> ...` generates the named jobs from
`prompts.py` (all of them if none are named) through OpenRouter, as PNGs in `reference/`;
convert them to WebP before committing. It needs OpenRouter access from the environment.

## From reference to game

1. Generate the model from its reference plate with Tripo's low-poly P series and the
   delighting texture model (no baked light):
   `tripo make plate.png --model tripo-p1 -p face_limit=3000 -p texture_version=v3.5-20260815`
   (50 credits with texture). Animals: add `--then rig-check,rig,retarget:...` with
   `--animate-in-place`; floating machines get no rig, the game animates them.
2. Shrink it: `npx @gltf-transform/cli optimize model.glb public/models/<name>.glb
   --texture-compress webp --texture-size 512 --compress false --simplify false`
   (the worker drone went from 1.9 MB to 121 KB).
3. Add `<name>` with its size in tiles to `SPECS` in `src/game/assets.ts`. The game loads it
   behind the loading screen and uses it in place of the model built in code; the glow and
   aura stay.
