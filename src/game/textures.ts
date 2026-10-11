import { Assets, Rectangle, Texture, TextureStyle } from "pixi.js";
import { tilesets } from "./definitions";

const imageUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../assets/tilesets/*.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.replace(/^.*\//, "").replace(/\.png$/, ""), url]),
);

/** The frames of one tileset, cut from its sprite sheet. */
export interface Tiles {
  frames: Texture[];
  /** Frames of the "selected" variant, when the tileset has one. */
  selected?: Texture[];
}

function sliceFrames(sheet: Texture, width: number, height: number): Texture[] {
  const perRow = Math.floor(sheet.width / width);
  const rows = Math.floor(sheet.height / height);
  const frames: Texture[] = [];
  for (let i = 0; i < perRow * rows; i++) {
    frames.push(
      new Texture({
        source: sheet.source,
        frame: new Rectangle((i % perRow) * width, Math.floor(i / perRow) * height, width, height),
      }),
    );
  }
  return frames;
}

async function loadSheet(image: string): Promise<Texture> {
  const url = imageUrls[image];
  if (!url) throw new Error(`Missing tileset image "${image}.png"`);
  return Assets.load<Texture>(url);
}

/** Load and slice every tileset. Pixel art, so textures are sampled without smoothing. */
export async function loadTiles(): Promise<Map<string, Tiles>> {
  TextureStyle.defaultOptions.scaleMode = "nearest";

  const entries = await Promise.all(
    Object.entries(tilesets).map(async ([name, tileset]): Promise<[string, Tiles]> => {
      const { width, height } = tileset.grid;
      const tiles: Tiles = { frames: sliceFrames(await loadSheet(tileset.image), width, height) };
      if (tileset.imageSelected) {
        tiles.selected = sliceFrames(await loadSheet(`${tileset.image}Selected`), width, height);
      }
      return [name, tiles];
    }),
  );
  return new Map(entries);
}
