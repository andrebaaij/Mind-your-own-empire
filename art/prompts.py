SCENE = ("Cinematic sci-fi concept art, painterly realism in the vein of high-end film pre-production paintings, "
 "atmospheric haze, subtle film grain, restrained palette, no text, no logos, no letters. World: Lessuin, a dry alien planet "
 "of rust-red ground with deep plum shadows, ochre sand, small glowing acid-green pools, orange iron crystals that grow from the ground, "
 "a hazy lilac sky with an enormous banded peach-and-plum ringed gas giant. ")
ASSET = ("Game asset concept art for a 3D model, a single object, three-quarter view from slightly above, centred, the whole object in frame "
 "with margin, on a plain flat light warm-grey background, soft even studio light with a gentle warm key from the upper left, clean readable silhouette, "
 "no ground plane clutter, no cast shadow besides a faint contact shadow, no text, no labels, no UI. Style: stylized realism with hand-painted PBR-ready "
 "surfaces, chunky readable shapes for a top-down real-time strategy game, like premium RTS art. ")
SHEET = ("Game concept art sheet for 3D modelling, several separate objects laid out in a neat row with space between them, each in three-quarter view, "
 "on a plain flat light warm-grey background, soft even studio light, clean silhouettes, no text, no labels. Style: stylized realism with hand-painted "
 "PBR-ready surfaces, chunky readable shapes for a top-down real-time strategy game. ")
CULTURE = ("Culture (Iain M. Banks) technology: smooth, seamless, softly bevelled forms in matte graphite and warm ceramic white, no visible bolts or panels, "
 "elegant and slightly smug, floating on soft glowing cyan aura fields (#5fe0ff) rather than wheels or thrusters. ")
CUSTODY = ("Custody caretaker machinery left by a sublimed civilisation: floating rings and lenses of aged verdigris bronze with patina, "
 "fine dangling manipulator filaments, warm amber working lights (#ffb347), ornate but practical, house-proud and ancient. ")
IDIRAN = ("Idiran military technology: heavy, angular, armoured gunmetal and dark oxblood plating, faceted wedge shapes, triple symmetry, "
 "harsh red signal lights (#ff4a2a), brutal, religious, utilitarian, scuffed by use. ")
TESS = ("Tessilend architecture: an ancient sublimed civilisation that grew its buildings from pale bone-white crystalline lattice, "
 "slender organic arches and columns with hexagonal facets, faint teal-green light (#7ff0cc) in the seams, weathered, sand-scoured, beautiful. ")

JOBS = {
 # Mood / environment
 "env-landfall": ("16:9", SCENE + "Late afternoon. Middle distance: elegant ancient Tessilend ruins, " + TESS + "Foreground right: a smooth graphite-and-ceramic egg-shaped armoured machine core lies in a fresh crash furrow, three small sleek floating drones with soft cyan aura fields hover near it, one scanning an orange crystal with a cyan beam. Far away a huge slow long-legged creature crosses the horizon. Vast, quiet, melancholy, gently absurd. Dark negative space on the left third."),
 "env-garden-city": ("16:9", SCENE + "A vast abandoned Tessilend garden city in a shallow valley: " + TESS + "Terraces of rust-coloured overgrown gardens, dry aqueducts, softly glowing lantern plants along old paved avenues, and floating bronze caretaker rings with amber lights quietly sweeping the empty streets. Everything immaculately kept for nobody. Golden hour, long shadows, dust in the light."),
 "env-skimmer-sweep": ("16:9", SCENE + "Dusk, the sky darkening to violet with the gas giant lit on one side. A flight of heavy angular Idiran search skimmers, " + IDIRAN + "sweeps low over a rust-red plain, each casting a wide fan of red scanning light on the ground. In the foreground, hidden under the dark canopy of a grove of strange umbrella-like alien trees, three small Culture drones with dimmed cyan aura fields wait silently. Tense, stealthy, beautiful."),
 "env-refugees": ("16:9", SCENE + "Night under the gas giant. A small cluster of softly lit Culture structures, smooth graphite and ceramic white, around a glowing landing pad ringed with cyan lights. A sleek elongated Culture refugee ship descends on columns of soft light, its belly lit. Ancient Tessilend crystal ruins glow teal nearby. Floating bronze caretaker rings with amber lights watch from a respectful distance. Hopeful, warm, quiet."),
 "env-relic-site": ("16:9", SCENE + "Close establishing shot of a Tessilend relic site: a ring of pale crystalline lattice monoliths around a sunken paved court, teal-green crystal seams growing out of the cracked paving like frost, faint hum visible as shimmering air. Two small Culture drones with cyan aura fields study it with fine cyan beams. A bronze caretaker ring with amber lights hovers disapprovingly nearby. Mysterious, reverent, a little funny."),
 # Player assets
 "asset-mind-core": ("1:1", ASSET + CULTURE + "The Mind's armoured core: a large smooth egg-shaped vessel, about the size of a house, matte graphite with a ceramic-white band, scorched and scraped from a hard landing, a soft cyan glow leaking from a thin seam, resting slightly tilted and half sunk in red earth with a few cables of light running into the ground."),
 "asset-worker-drone": ("1:1", ASSET + CULTURE + "A small worker drone, about the size of a suitcase: a rounded wedge body in ceramic white and graphite, two neat folding manipulator arms underneath holding an orange iron crystal, a soft cyan aura disc glowing beneath it, a single small sensor slit. Friendly, competent, slightly smug."),
 "asset-scout-drone": ("1:1", ASSET + CULTURE + "A fast scout drone: a slim teardrop dart in ceramic white with graphite fins, swept-back aura vanes glowing cyan, built for speed and altitude, elegant like a bird of prey."),
 "asset-solar-array": ("1:1", ASSET + CULTURE + "A Culture solar array building on a small square footprint: a cluster of thin floating hexagonal photovoltaic petals, dark iridescent blue-black, tilted toward the sun above a smooth ceramic plinth, held in place by faint cyan fields, no struts."),
 "asset-sensor-spire": ("1:1", ASSET + CULTURE + "A sensor spire building: a tall slender tapering needle in ceramic white and graphite rising from a small plinth, a ring of floating sensor lenses orbiting near the top, cyan light at the tip. Elegant and very tall relative to its base."),
 "asset-decoy": ("1:1", ASSET + CULTURE + "A decoy beacon: a small hastily built pylon of graphite and ceramic, an untidy collection of antennas and dishes all pointing in different directions, a pulsing cyan light, deliberately loud and a bit ridiculous."),
 "asset-landing-pad": ("1:1", ASSET + CULTURE + "A landing pad building: a wide flat circular ceramic-white platform on a square footprint, inlaid with concentric glowing cyan guide rings and small floating light buoys at the rim, very clean, welcoming."),
 # Custody
 "asset-warden": ("1:1", ASSET + CUSTODY + "A Custody warden: a floating vertical ring of verdigris bronze about two metres across with a central amber lens eye, trailing a skirt of fine bronze manipulator filaments, small tool attachments, worn engraved patterns of the builders on its surface."),
 # Idirans
 "asset-skimmer": ("1:1", ASSET + IDIRAN + "An Idiran search skimmer: a heavy armoured hovering craft with a triangular wedge hull, three downward-facing scanner pods glowing red, a raised armoured cockpit hump, sized for three-metre-tall pilots."),
 "asset-idiran-camp": ("1:1", ASSET + IDIRAN + "An Idiran forward camp on a square footprint: a dug-in faceted armoured bunker dome with a tripod sensor mast, stacked supply crates, a triangular perimeter of short barricades, red lights, sandbagged into rust-red earth."),
 # Tessilend
 "asset-tess-arch": ("1:1", ASSET + TESS + "A single ruined Tessilend arch with a broken column beside it, standing on a fragment of hexagonal paving, sand drifted against the base."),
 "asset-uplink": ("1:1", ASSET + TESS + "A Tessilend transmitter: a tall crystalline lattice tower like a frozen fountain, with a Culture graphite-and-cyan device clamped to its base wired into it with glowing cables, teal light pulsing up the tower."),
 "sheet-resources": ("16:9", SHEET + "Resources, left to right: a small cluster of orange iron crystals growing from red earth (bloom), a large bloom crystal deposit, a teal-green lattice crystal seam growing out of cracked pale paving like frost, a large lattice crystal outcrop. Crystals glow softly from inside."),
 # Flora / fauna
 "sheet-flora": ("16:9", SHEET + "Alien flora of Lessuin, left to right: a grove tree like a tall dark umbrella with a broad plum-coloured canopy and pale twisted trunk; a lantern plant, a curved stalk with a softly glowing warm bulb; a cluster of glowing bulb fungi; a spiky dry rust-red shrub; a tuft of pale ochre alien grass; a weathered red sandstone rock."),
 "sheet-fauna": ("16:9", SHEET + "Alien wildlife of Lessuin, left to right, with a tiny drone silhouette for scale: a trundler, a six-legged armoured grazing beast about the size of a cow with ochre and rust plating; a kite, a manta-winged gliding creature with translucent plum wings; a longshank, an enormous slow strider on four extremely long thin legs with a small high body, many times taller than the others."),
 # Materials
 "sheet-terrain": ("16:9", "Seamless-looking square terrain material swatches for a stylized realistic RTS game, top-down orthographic view, laid out as six square tiles in a grid with thin gaps on a dark background, no text: rust-red packed dirt with small pebbles; ochre wind-rippled sand; glowing acid-green pool surface with a crusty rim; pale hexagonal Tessilend paving with cracks and sand; dark plum cliff rock face; rust dirt with sparse pale grass. Hand-painted PBR-ready, consistent warm late-afternoon lighting."),
}
IDIRAN_BEING = ("An Idiran: a huge three-metre-tall alien warrior standing on three thick pillar-like legs arranged in a tripod, no human shape at all, "
 "a massive armoured barrel body with natural plated carapace hide in dark olive-brown, two powerful arms, a large heavy head with a hard bony beak-like "
 "jaw and small deep-set eyes under a crested armoured brow, wearing gunmetal and oxblood combat armour with harsh red lights, carrying a heavy rifle. "
 "Imposing, solemn, zealous, ancient. ")
JOBS["asset-idiran"] = ("1:1", ASSET + IDIRAN_BEING)
JOBS["sheet-factions"] = ("16:9", SHEET + "Faction lineup for scale and colour, all at the same scale, left to right: "
 "a Culture worker drone, a small suitcase-sized rounded wedge body in ceramic white and graphite with two folding manipulator arms underneath and a soft cyan aura disc beneath it; "
 "a Custody warden, a floating vertical ring of verdigris bronze two metres across with an amber lens eye and dangling bronze manipulator filaments; "
 "an Idiran search skimmer (" + IDIRAN + "a triangular wedge hull hovering on three red scanner pods); " + IDIRAN_BEING.replace("An Idiran:", "and an Idiran:"))
JOBS["key-art"] = ("16:9", SCENE + "Late afternoon. Middle distance: elegant ancient alien ruins, " + TESS + "tall slender arches and columns half-buried in sand. Foreground right: a smooth graphite-and-ceramic egg-shaped armoured machine core lies in a fresh crash furrow, three small sleek floating drones with soft cyan aura fields hover near it, one scanning a crystal. Far away a huge slow long-legged creature crosses the horizon. Vast, quiet, melancholy, gently absurd. Dark negative space on the left third.")
