import { Application, Container, Graphics, Sprite, type Texture } from "pixi.js";
import { CHUNK_SIZE, FOG_EXPLORED_TILE, TILE_HEIGHT, TILE_WIDTH } from "./config";
import { gridFromWorld, worldFromGrid } from "./coords";
import { getTileset } from "./definitions";
import { buildTiles, canPlace, type GameState, selectionRect } from "./state";
import { loadTiles, type Tiles } from "./textures";
import { boxCenter, type Color, type Unit } from "./units";
import type { Chunk } from "./world";

interface ChunkView {
  version: number;
  terrain: Sprite[];
  resources: Sprite[];
  fog: Sprite[];
  containers: Container[];
}

function toTint(color: Color): number {
  return (Math.round(color.r) << 16) | (Math.round(color.g) << 8) | Math.round(color.b);
}

/** Keeps a pool of sprites in a layer, reusing them frame to frame. */
class SpritePool {
  private readonly sprites: Sprite[] = [];
  private used = 0;

  constructor(private readonly layer: Container) {}

  next(texture: Texture): Sprite {
    let sprite = this.sprites[this.used];
    if (!sprite) {
      sprite = new Sprite();
      this.sprites.push(sprite);
      this.layer.addChild(sprite);
    }
    this.used++;
    sprite.texture = texture;
    sprite.visible = true;
    sprite.alpha = 1;
    sprite.tint = 0xffffff;
    return sprite;
  }

  /** Hide every sprite not handed out since the last call. */
  finish(): void {
    for (let i = this.used; i < this.sprites.length; i++) {
      const sprite = this.sprites[i];
      if (sprite) sprite.visible = false;
    }
    this.used = 0;
  }
}

export class Renderer {
  private readonly world = new Container();
  private readonly terrainLayer = new Container();
  private readonly resourceLayer = new Container();
  private readonly actionLayer = new Container();
  private readonly unitLayer = new Container({ sortableChildren: true });
  private readonly ghostLayer = new Container();
  private readonly fogLayer = new Container();
  private readonly selection = new Graphics();

  private readonly chunkViews = new Map<Chunk, ChunkView>();
  private readonly visibleChunks = new Set<ChunkView>();
  private readonly unitSprites = new Map<Unit, Sprite>();
  private readonly actionPool = new SpritePool(this.actionLayer);
  private readonly ghostPool = new SpritePool(this.ghostLayer);

  private constructor(
    readonly app: Application,
    private readonly tiles: Map<string, Tiles>,
  ) {
    this.world.addChild(
      this.terrainLayer,
      this.resourceLayer,
      this.actionLayer,
      this.unitLayer,
      this.ghostLayer,
      this.fogLayer,
      this.selection,
    );
    app.stage.addChild(this.world);
  }

  static async create(parent: HTMLElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      preference: ["webgpu", "webgl"],
      resizeTo: window,
      background: "#000000",
      antialias: false,
      roundPixels: true,
      resolution: window.devicePixelRatio,
      autoDensity: true,
    });
    parent.prepend(app.canvas);
    return new Renderer(app, await loadTiles());
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  private frames(tileset: string): Texture[] {
    const tiles = this.tiles.get(tileset);
    if (!tiles) throw new Error(`Tileset "${tileset}" is not loaded`);
    return tiles.frames;
  }

  private frame(tileset: string, index: number): Texture {
    const texture = this.frames(tileset)[index];
    if (!texture) throw new Error(`Tileset "${tileset}" has no frame ${index}`);
    return texture;
  }

  render(state: GameState): void {
    this.world.position.set(state.camera.x, state.camera.y);
    this.renderChunks(state);
    this.renderUnits(state);
    this.renderActions(state);
    this.renderGhosts(state);
    this.renderSelection(state);
  }

  private renderChunks(state: GameState): void {
    // Chunks overlapping the screen, with a one-chunk margin for sprites that overhang.
    const corners = [
      { x: 0, y: 0 },
      { x: this.width, y: 0 },
      { x: 0, y: this.height },
      { x: this.width, y: this.height },
    ].map((screen) =>
      gridFromWorld({ x: screen.x - state.camera.x, y: screen.y - state.camera.y }),
    );
    const minX = Math.min(...corners.map((c) => c.chunkX)) - 1;
    const maxX = Math.max(...corners.map((c) => c.chunkX)) + 1;
    const minY = Math.min(...corners.map((c) => c.chunkY)) - 1;
    const maxY = Math.max(...corners.map((c) => c.chunkY)) + 1;

    const nowVisible = new Set<ChunkView>();
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const chunk = state.world.getChunk(cx, cy);
        const view = this.chunkView(chunk);
        if (view.version !== chunk.version) this.syncChunk(chunk, view);
        nowVisible.add(view);
      }
    }

    for (const view of this.visibleChunks) {
      if (!nowVisible.has(view)) for (const c of view.containers) c.visible = false;
    }
    for (const view of nowVisible) {
      for (const c of view.containers) c.visible = true;
    }
    this.visibleChunks.clear();
    for (const view of nowVisible) this.visibleChunks.add(view);
  }

  private chunkView(chunk: Chunk): ChunkView {
    let view = this.chunkViews.get(chunk);
    if (view) return view;

    const terrain = new Container();
    const resources = new Container();
    const fog = new Container();
    view = {
      version: -1,
      terrain: [],
      resources: [],
      fog: [],
      containers: [terrain, resources, fog],
    };

    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      const center = worldFromGrid(
        chunk.x * CHUNK_SIZE + (i % CHUNK_SIZE),
        chunk.y * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE),
      );
      const x = center.x - TILE_WIDTH / 2;
      const y = center.y - TILE_HEIGHT / 2;

      for (const [list, layer] of [
        [view.terrain, terrain],
        [view.resources, resources],
        [view.fog, fog],
      ] as const) {
        const sprite = new Sprite();
        sprite.position.set(x, y);
        sprite.visible = false;
        list.push(sprite);
        layer.addChild(sprite);
      }
    }

    this.terrainLayer.addChild(terrain);
    this.resourceLayer.addChild(resources);
    this.fogLayer.addChild(fog);
    this.chunkViews.set(chunk, view);
    return view;
  }

  private syncChunk(chunk: Chunk, view: ChunkView): void {
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      const explored = chunk.explored[i] === 1;
      const watched = (chunk.watchers[i] ?? 0) > 0;

      const terrain = view.terrain[i];
      if (terrain) {
        terrain.visible = explored;
        if (explored) terrain.texture = this.frame("tiles", chunk.tiles[i] ?? 0);
      }

      const resourceSprite = view.resources[i];
      const resource = chunk.resources[i];
      if (resourceSprite) {
        resourceSprite.visible = explored && !!resource?.exists && resource.level >= 0;
        if (resourceSprite.visible && resource) {
          resourceSprite.texture = this.frame(resource.kind, resource.level);
        }
      }

      const fog = view.fog[i];
      if (fog) {
        fog.visible = explored && !watched;
        if (fog.visible) fog.texture = this.frame("tiles", FOG_EXPLORED_TILE);
      }
    }
    view.version = chunk.version;
  }

  private renderUnits(state: GameState): void {
    for (const unit of state.units) {
      let sprite = this.unitSprites.get(unit);
      if (!sprite) {
        sprite = new Sprite();
        this.unitSprites.set(unit, sprite);
        this.unitLayer.addChild(sprite);
      }
      const tiles = this.tiles.get(unit.name);
      const frames = (unit.selected && tiles?.selected) || this.frames(unit.name);
      const texture = frames[unit.frame];
      if (texture) sprite.texture = texture;
      sprite.position.set(
        Math.round(unit.position.x - unit.center.x),
        Math.round(unit.position.y - unit.center.y),
      );
      sprite.zIndex = unit.position.y;
      sprite.tint = toTint(unit.color);
      sprite.alpha = unit.color.a;
    }
  }

  private renderActions(state: GameState): void {
    const actions = getTileset("actions");
    for (const unit of state.selection) {
      for (const action of unit.actions) {
        const index = actions.animations?.[action.kind]?.N[0] ?? 0;
        const sprite = this.actionPool.next(this.frame("actions", index));
        sprite.position.set(
          Math.round(action.target.x - actions.grid.width / 2),
          Math.round(action.target.y - actions.grid.height / 2),
        );
      }
    }
    this.actionPool.finish();
  }

  private renderGhosts(state: GameState): void {
    if (state.building) {
      const tileset = getTileset(state.building);
      const idle = tileset.animations?.[tileset.defaultAnimation ?? "rest"]?.NE[0] ?? 0;
      const center = boxCenter(tileset.collisionBox ?? { lx: 0, ty: 0, rx: 0, by: 0 });
      const texture = this.frame(state.building, idle);

      for (const tile of buildTiles(state.pointer)) {
        const position = worldFromGrid(tile.x, tile.y);
        const sprite = this.ghostPool.next(texture);
        sprite.position.set(Math.round(position.x - center.x), Math.round(position.y - center.y));
        // Red where the building can't go, like AoE's placement preview.
        sprite.tint = canPlace(state, state.building, tile) ? toTint(state.player.color) : 0xff4040;
        sprite.alpha = 0.6;
      }
    }
    this.ghostPool.finish();
  }

  private renderSelection(state: GameState): void {
    this.selection.clear();
    if (!state.pointer.dragStart || state.building) return;
    const rect = selectionRect(state.pointer);
    this.selection
      .rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
      .fill({ color: 0xffffff, alpha: 0.15 })
      .stroke({ color: 0xffffff, alpha: 0.8, width: 1 });
  }
}
