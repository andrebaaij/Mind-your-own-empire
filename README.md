# Mind your own Empire

A single-player, procedurally generated 3D RTS for the browser, inspired by Iain M. Banks' Culture novels.

The Idiran war. A Culture Mind called *Only Visiting* comes down hard on a world whose builders Sublimed long ago, leaving their machines to keep the place tidy. The caretakers would like it to leave, the Idirans would like it destroyed, and the Mind would mostly like its sensors back. The setting and story are being worked out in [docs/World.md](docs/World.md) (contains spoilers).

The whole ten-mission campaign is playable, in three acts:

**Act I · Landfall**

1. **Arrived.** Learn the ropes: harvest bloom, carry it home, build drones, keep the power up, raise a sensor spire.
2. **The Staff.** Meet the Custody, the caretaker machines that dismantle anything left unattended, read the marker stone that names the world, and keep your base standing.
3. **House Rules.** Read a Tessilend archive, mine lattice, restore a power tap, build on the builders' foundations, and find what the staff are guarding.

**Act II · Company**

4. **Ah. Company.** The Idirans arrive. Run silent, hide under the groves, and lead their skimmers off with decoys.
5. **Trespassers.** Lure the guards away from three Idiran camps so the staff evict them.
6. **Post.** Race the Idirans to a Culture supply pod.
7. **Relics.** Restore a Tessilend transmitter and keep it charging while the Idirans close in.

**Act III · Arrivals**

8. **Sealed Orders.** The Mind's sealed memory opens: refugees are coming. Build landing pads and survey the empty habitats.
9. **Tenancy.** Find the builders' records that prove the habitats were built for guests, and present them to the staff.
10. **Only Visiting.** The flotilla lands under Idiran attack, with the staff on your side.

Each mission opens with a short, skippable intro: the camera tours the places that matter, with a title card and captions. The **Codex** (main menu or pause menu) keeps everything the Mind has learned across games: the story so far, the Tessilend archive fragments, marker inscriptions, the sites, the Custody, the Idirans and the wildlife. In Settings, the Mind can speak its lines aloud with the browser's own speech synthesis.

There's also **Survey** mode: free play on any seed, with no objectives.

![The Mind and its drones](docs/screenshot-3d.png)

It started in 2014 as a 2D isometric game ([2015 screenshot](docs/screenshot-2015-01-03.png)); the old sprites are kept in `art/legacy-2d/`.

## Playing

| Input | Action |
| --- | --- |
| Left click / drag | Select units, or place the chosen building on every free tile in the drag area (red tiles are blocked) |
| Right click / drag | Order the selection: mine the bloom or lattice in the area, study a Tessilend site, or walk to the pointer |
| Shift + right click | Queue the order after the current ones instead of replacing them |
| W A S D / arrow keys | Pan the camera (hold Shift to pan faster) |
| Q / E, or middle-mouse drag | Rotate the camera |
| Mouse wheel | Zoom (zoom right in and the camera tilts up to look out across the land) |
| 1 / 2 / 3 / 4 | Pick a worker drone, collector, sensor spire or (once learned) scout drone to place (press again to put it away) |
| Shift while placing | Keep the building selected to place more |
| . (full stop) | Select idle worker drones and centre on them |
| Ctrl+Shift+1–9 (or Ctrl+1–9) | Store the selection as a control group |
| Shift+1–9 | Select a control group; press twice to look at it |
| Double-click a unit | Select every unit of that kind on screen |
| Minimap | Left-click or drag to look there; right-click to send the selection |
| C / Shift + C | Cancel the next order / all orders of the selection |
| Esc | Leave build mode and clear the selection |
| P | Pause |
| R | Run silent: half speed, a third as easy for the Idirans to detect |
| M | Sound on / off (wind and distant chimes start on your first click or key press) |
| P, then Save game / Settings | Save (the game also autosaves every two minutes; **Continue** on the main menu picks up the last save), or change graphics, volumes, the Mind's spoken voice, text size and motion |

In Survey mode, the seed on the start screen picks the map, so the same seed always gives the same world.

### How it plays

- **Bloom** is iron the Tessilend grew rather than mined: orange crystals the Custody still seeds. Worker drones harvest it, carrying 10 at a time back to the Mind, which stores up to 1,000. (The code calls it `iron`.)
- **Power** comes from the Mind's reactor and from collectors, and every drone and spire uses some. If it drops below zero, every drone works at half speed.
- **The Custody's wardens** patrol and dismantle any building that has no drone nearby and isn't covered by a sensor spire. A building they're eyeing gets an amber ring, which is your warning to send someone over. Anything built on Tessilend paving is "built to plan", and they leave it alone.
- **Tessilend sites** are scattered across the map. Right-click one with worker drones to study it; more drones study faster, and clicking a site shows what it is and how the study is going. Archives tell the builders' story and chart other sites. Power taps give +8 power once restored. Fabrication beds teach new designs (the scout drone). Seedbeds make lattice grow back. Habitats stay sealed.
- **The Idirans** (from mission 4) search with skimmers. Everything you own gives off a signature: the Mind most of all, moving drones more than idle ones. Whatever a skimmer picks up raises the detection meter, and at 100% you're found. Run silent, keep drones under the parasol groves, and plant **decoy beacons**: a skimmer that hears one goes to smash it, calms down, and searches around there instead. Left alone, the Idirans narrow the search and close in. From mission 5 they also dig in: an Idiran camp is attended by its guard skimmer, and the Custody evicts it (fast) whenever the guard is lured away.
- **Lattice** is the builders' crystal, found in seams around their sites. Drones mine it at half the speed of bloom; the Mind stores up to 200. It restores power taps and pays for designs learned from the Tessilend.

## Development

You need Node.js 22.12 or newer (`.nvmrc` pins the version CI uses).

```sh
npm install
npm run dev        # dev server with hot reload at http://localhost:5173
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

Add `?debug` to the game URL to expose the running game as `window.mindGame` in the console.

Graphics quality is chosen automatically: `high` (ambient occlusion, sky lighting, detailed ground) on a real GPU, `low` on software rendering such as headless CI. Add `?quality=high` or `?quality=low` to the game URL to override it.

Checks, all of which run in CI:

```sh
npm run lint       # Biome lint + format check (npm run format to fix)
npm run typecheck  # TypeScript
npm test           # Vitest unit tests
npm run test:e2e   # Playwright browser tests against the production build
```

Run `npx playwright install chromium` once before the first `npm run test:e2e`.

### Stack

- **TypeScript** and **Vite**, built as two pages: `index.html` (start menu) and `game.html`.
- **Three.js** renders the world in 3D with `WebGPURenderer`: WebGPU where the browser supports it, WebGL 2 otherwise. Shadows and bloom are included, and all models are built in code (`models.ts`), with no asset files.
- **simplex-noise** with an **Alea** seeded random generator for terrain and bloom.
- The interface is plain HTML and CSS overlaid on the 3D view: translucent glass panels with luminous edges, accented in the player's colour. Icons are inline SVG.
- **Biome** for linting and formatting, **Vitest** for unit tests and **Playwright** for browser tests.

### Layout

```
src/
  game/
    main.ts         entry point: wires state, renderer, input and HUD; fixed 60 Hz simulation loop
    state.ts        game state, economy and player commands (select, build, order, camera)
    missions.ts     the campaign: briefings, objectives, scripted events, the Mind's lines
    custody.ts      the caretaker machines and their rules
    units.ts        units and buildings: footprints, path following, unit avoidance, gathering
    pathfinding.ts  A* route planning, path smoothing, group destination spreading
    world.ts        chunked world: ground, heights, cliffs, bloom and fog of war
    terrain.ts      noise-based terrain: ground types, heights and bloom
    coords.ts       tile and ground-plane maths
    renderer.ts     Three.js scene: terrain meshes, units, previews, camera, picking
    scenery.ts      flora, rocks, ruins and crash debris: placement and instanced drawing
    atmosphere.ts   sky, sun, the gas giant and drifting spores
    fauna.ts        wildlife behaviour: grazing herds, circling flocks, the longshank
    creatures.ts    wildlife models and animation
    sites.ts        where Tessilend sites are: placement, paving, lattice seams
    relics.ts       studying sites and what each kind does
    ruins.ts        site models and their look as they wake
    stealth.ts      the Idiran search: signatures, detection, skimmers, decoys
    cover.ts        shared noise, and where the groves (cover) are
    ground.ts       the ground's shader detail
    events.ts       game events the simulation records for effects and sound
    effects.ts      particles, rings, floating text, camera shake
    minimap.ts      the minimap
    save.ts         saving and loading
    settings.ts     player settings (and settingsPanel.ts, the dialog)
    voice.ts        the Mind's spoken voice (browser speech synthesis)
    cinematic.ts    mission intros
    lore.ts         codex entries (and codexStore.ts, the stored codex)
    audio.ts        the synthesised ambient soundscape
    models.ts       procedural 3D models: the Mind, drones, towers, solar arrays, bloom crystals
    input.ts        mouse and keyboard handling, picking through the 3D view
    hud.ts          resources, build bar, selection panel, messages, pause dialog
    definitions.ts  typed access to the JSON data below
  data/             object and resource definitions (JSON)
  assets/           fonts
  styles/           CSS: shared design tokens and glass panels, menu and in-game HUD
tests/              unit tests
e2e/                browser tests
art/                source artwork (GIMP .xcf), the old 2D sprites and unused images, not shipped
docs/               design notes
```

### The 3D world

- **Units:** one tile is one world unit, horizontally and vertically. The game logic works on the ground plane, and height is only added when placing things in 3D.
- **Terrain:** heights come from noise. Rolling hills, sharp ridges whose steepest parts become cliffs, and hollows where acid pools. The ground around the starting base is flattened so you can build there.
- **Cliffs:** a step between neighbouring tiles that climbs more than `MAX_CLIMB` can't be walked. Climbing gentler slopes costs extra, so routes go around hills when that isn't much further.
- **Buildings:** they need fairly level ground, so placement is refused if the footprint varies in height by more than `MAX_BUILD_SLOPE`.
- **Drones and flying:** worker drones hover close to the ground and follow paths. The scout flies higher and goes straight over acid, cliffs and buildings. Flying and ground units don't block each other.
- **Fog:** unexplored ground isn't drawn (it fades into the haze), and explored ground nobody can currently see is dimmed.
- **Scenery:** rust-grass, copperleaf shrubs, lantern stalks, parasol trees, boulders, Tessilend ruins and the wreckage of the Mind's landing. It's placed per tile from a hash of the tile's position, so a world always looks the same. It's purely visual: it never blocks anything, and it disappears under buildings. Each kind is one instanced mesh, and plants sway in the wind in the vertex shader.
- **Wildlife:** herds of six-legged trundlers graze and bolt from drones, flocks of kites circle over the groves, and now and then a longshank, an animal the size of a house, strides across the far country. Like the scenery, it has no effect on the game. Small animals are only seen where the player has eyes, but a longshank is tall enough to be seen over any explored ground. Only animals near the camera are simulated, and any that wander off are moved back somewhere out of sight.
- **Atmosphere:** late-afternoon light, with a low sun for long shadows and haze in the distance. The sky has a ringed gas giant on the horizon, glowing spores drift past, and acid pools shimmer. Zooming in lowers the camera towards the horizon.

### Pathfinding

Movement follows the approach classic RTS games such as Age of Empires use, split into two layers:

- **Long-range planning** (`pathfinding.ts`): A* over the tile grid, using only what the player knows. Explored acid, explored cliffs and the tiles under buildings are impassable. Unexplored ground is assumed walkable, so routes don't give away what's hidden in the fog. When a unit uncovers acid or a cliff, or a new building cuts across its remaining route, it re-plans. Units never cut diagonally between two blocked tiles. The search stays within a box around where the order was given and the target, so an unreachable target can't send units roaming the map. They get as close as they can and stop. The route is then smoothed into straight legs. If the target can't be reached, the unit walks to the nearest tile it can reach. The search has a node budget, and at most a few new routes are planned per tick, so a large group order can't stall a frame.
- **Short-range avoidance** (`units.ts`): units keep a little personal space. A unit that runs into another one first swerves, always to its own right so two units meeting head-on pass each other. If it can't swerve, it waits briefly for a moving unit to clear. After that it re-plans its route around the blocker, and it gives up after a few attempts. If the destination itself is taken by a unit that isn't moving, getting close counts as arriving.
- **Groups**: every unit in a move order gets its own spot around the clicked point, and spots go to the nearest units first, so groups fan out instead of piling up. Gatherers each start on a different bloom tile.
- **Buildings**: buildings occupy the tiles under their base. They can't be placed on unexplored, blocked or acid tiles, and units standing on a new building's footprint are moved out of the way.

The simulation in `state.ts`, `missions.ts`, `custody.ts`, `units.ts`, `pathfinding.ts`, `world.ts`, `terrain.ts` and `coords.ts` has no DOM or rendering dependencies, so it can be unit-tested in Node.

## Deployment

Every push to `master` builds the game and publishes it to GitHub Pages using `.github/workflows/deploy.yml`. Pages has to be enabled once under **Settings → Pages → Source: GitHub Actions**.

## License

MIT. See [LICENSE](LICENSE).
