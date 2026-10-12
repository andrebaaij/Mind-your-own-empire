/**
 * Procedural models for Tessilend sites, and their look as they come back to life: glyphs and
 * seams dark while dormant, pulsing while studied, amber while waiting for lattice, and bright
 * once awake, with whatever moving parts the site has set going.
 */

import * as THREE from "three/webgpu";
import { gridRef } from "./coords";
import type { Site, SiteKind } from "./sites";
import type { World } from "./world";

const stone = new THREE.MeshStandardMaterial({
  color: "#b8ab95",
  roughness: 0.8,
  flatShading: true,
});
const darkStone = new THREE.MeshStandardMaterial({
  color: "#7d7263",
  roughness: 0.85,
  flatShading: true,
});
const verdigris = new THREE.MeshStandardMaterial({
  color: "#4f8a77",
  roughness: 0.55,
  metalness: 0.4,
});
const shaft = new THREE.MeshStandardMaterial({ color: "#2a2c31", roughness: 0.4, metalness: 0.6 });
const windowLight = new THREE.MeshStandardMaterial({
  color: "#ffd9a0",
  emissive: "#ffb866",
  emissiveIntensity: 1.6,
});

const GLOW = new THREE.Color("#5fe0b8");
const WAITING = new THREE.Color("#ffb347");

/** Lattice: clusters of green-blue hexagonal crystal. */
export function createLatticeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shards = [
    [0, 0, 0, 0.55, 0.09],
    [0.12, 0.05, 0.5, 0.38, 0.07],
    [-0.1, -0.08, -0.6, 0.32, 0.06],
    [0.02, 0.13, -0.2, 0.26, 0.05],
  ] as const;
  for (const [x, z, tilt, height, radius] of shards) {
    const shard = new THREE.CylinderGeometry(radius * 0.7, radius, height, 6);
    shard.translate(0, height / 2, 0);
    shard.rotateZ(tilt * 0.6);
    shard.rotateX(tilt * 0.4);
    shard.translate(x, 0, z);
    parts.push(shard.toNonIndexed());
  }
  const geometry = mergeAll(parts);
  geometry.computeVertexNormals();
  return geometry;
}

export const latticeMaterial = new THREE.MeshStandardMaterial({
  color: "#7ff0cc",
  emissive: "#22b58a",
  emissiveIntensity: 1.1,
  roughness: 0.15,
  metalness: 0.1,
  transparent: true,
  opacity: 0.92,
});

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const total = parts.reduce((n, g) => n + g.getAttribute("position").count, 0);
  const positions = new Float32Array(total * 3);
  let offset = 0;
  for (const part of parts) {
    const p = part.getAttribute("position").array as Float32Array;
    positions.set(p, offset);
    offset += p.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

interface SiteModel {
  root: THREE.Group;
  /** This site's own glow material, so each site can shine on its own terms. */
  glow: THREE.MeshStandardMaterial;
  /** Animate the moving parts; `life` goes from 0 (dormant) to 1 (awake). */
  animate(time: number, life: number): void;
}

function glowMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#1d3a33",
    emissive: GLOW.clone(),
    emissiveIntensity: 0.15,
    roughness: 0.3,
  });
}

/** A four-sided marker stone with a band of glyphs. */
function marker(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const pillar = mesh(new THREE.CylinderGeometry(0.17, 0.24, 1.3, 4), stone);
  pillar.rotation.y = Math.PI / 4;
  pillar.position.y = 0.65;
  const cap = mesh(new THREE.ConeGeometry(0.19, 0.25, 4), darkStone);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 1.42;
  const glyphs = mesh(new THREE.CylinderGeometry(0.205, 0.21, 0.32, 4, 1, true), glow);
  glyphs.rotation.y = Math.PI / 4;
  glyphs.position.y = 0.95;
  root.add(pillar, cap, glyphs);
  return { root, glow, animate: () => {} };
}

/** Four slabs around a lectern, a glyph disc floating above it once woken. */
function archive(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const base = mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.2, 8), darkStone);
  base.position.y = 0.1;
  root.add(base);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const slab = mesh(new THREE.BoxGeometry(0.85, 1.7, 0.22), stone);
    slab.position.set(Math.cos(angle) * 1.05, 1.0, Math.sin(angle) * 1.05);
    slab.rotation.y = -angle + Math.PI / 2;
    const seam = mesh(new THREE.BoxGeometry(0.08, 1.2, 0.24), glow);
    seam.position.copy(slab.position);
    seam.position.y = 1.0;
    seam.rotation.y = slab.rotation.y;
    root.add(slab, seam);
  }
  const lectern = mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.9, 6), verdigris);
  lectern.position.y = 0.65;
  const disc = new THREE.Group();
  disc.add(mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 32), glow));
  const inner = mesh(new THREE.CircleGeometry(0.3, 6), glow);
  disc.add(inner);
  disc.rotation.x = -Math.PI / 2;
  root.add(lectern, disc);
  return {
    root,
    glow,
    animate: (time, life) => {
      disc.position.y = 1.2 + life * (0.5 + Math.sin(time * 1.2) * 0.08);
      disc.rotation.z = time * 0.6 * life;
      disc.scale.setScalar(0.6 + life * 0.4);
    },
  };
}

/** A stone collar around a dark shaft, with rings that rise and spin once restored. */
function tap(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const collar = mesh(new THREE.CylinderGeometry(1.15, 1.4, 0.55, 10), stone);
  collar.position.y = 0.27;
  const core = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 12), shaft);
  core.position.y = 0.6;
  const seam = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 12), glow);
  seam.position.y = 0.95;
  root.add(collar, core, seam);
  const rings = [0, 1, 2].map((i) => {
    const ring = mesh(new THREE.TorusGeometry(0.75 - i * 0.14, 0.055, 6, 28), glow);
    root.add(ring);
    return ring;
  });
  return {
    root,
    glow,
    animate: (time, life) => {
      rings.forEach((ring, i) => {
        // Dormant rings lie slumped on the collar; restored, they float and turn.
        ring.position.y =
          0.62 + i * 0.05 + life * (0.9 + i * 0.45 + Math.sin(time * 1.5 + i) * 0.05);
        ring.rotation.x =
          Math.PI / 2 + (1 - life) * (0.25 - i * 0.2) + Math.sin(time * 0.8 + i) * 0.1 * life;
        ring.rotation.z = time * (0.5 + i * 0.3) * life;
      });
    },
  };
}

/** A long bed under two gantries that sweep over it once woken. */
function fabricator(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const bed = mesh(new THREE.BoxGeometry(2.5, 0.35, 2.0), stone);
  bed.position.y = 0.18;
  const plate = mesh(new THREE.BoxGeometry(1.9, 0.04, 1.4), glow);
  plate.position.y = 0.37;
  root.add(bed, plate);
  const gantries = [-1, 1].map((side) => {
    const gantry = new THREE.Group();
    for (const z of [-1.05, 1.05]) {
      const leg = mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), verdigris);
      leg.position.set(0, 0.75, z);
      gantry.add(leg);
    }
    const beam = mesh(new THREE.BoxGeometry(0.2, 0.18, 2.3), verdigris);
    beam.position.y = 1.5;
    const head = mesh(new THREE.ConeGeometry(0.1, 0.3, 6), glow);
    head.rotation.x = Math.PI;
    head.position.y = 1.3;
    gantry.add(beam, head);
    gantry.position.x = side * 0.8;
    root.add(gantry);
    return gantry;
  });
  return {
    root,
    glow,
    animate: (time, life) => {
      gantries.forEach((gantry, i) => {
        gantry.position.x = (i === 0 ? -0.8 : 0.8) + Math.sin(time * 0.9 + i * 2) * 0.35 * life;
      });
    },
  };
}

/** A low basin of growing lattice under a cage of ribs. */
function seedbed(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const basin = mesh(new THREE.CylinderGeometry(1.35, 1.15, 0.35, 14), darkStone);
  basin.position.y = 0.17;
  const soil = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 14), glow);
  soil.position.y = 0.36;
  root.add(basin, soil);
  const crystals = createLatticeGeometry();
  const sprouts: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const sprout = mesh(crystals, latticeMaterial);
    sprout.position.set(Math.cos(angle) * 0.6, 0.36, Math.sin(angle) * 0.6);
    sprout.rotation.y = angle;
    root.add(sprout);
    sprouts.push(sprout);
  }
  for (let i = 0; i < 3; i++) {
    const rib = mesh(new THREE.TorusGeometry(1.2, 0.04, 5, 24, Math.PI), verdigris);
    rib.rotation.y = (i / 3) * Math.PI;
    rib.position.y = 0.3;
    root.add(rib);
  }
  return {
    root,
    glow,
    animate: (time, life) => {
      sprouts.forEach((sprout, i) => {
        sprout.scale.setScalar(0.7 + life * (0.6 + Math.sin(time * 0.7 + i) * 0.08));
      });
    },
  };
}

/** Terraced, lit, empty: a Tessilend home kept ready for ten thousand years. */
function habitat(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const tiers = [
    [2.45, 2.55, 0.6, 0],
    [1.95, 2.05, 1.7, 0.6],
    [1.45, 1.55, 1.4, 2.3],
  ] as const;
  tiers.forEach(([top, bottom, height, y], tier) => {
    const body = mesh(
      new THREE.CylinderGeometry(top, bottom, height, 16),
      tier === 0 ? darkStone : stone,
    );
    body.position.y = y + height / 2;
    root.add(body);
    if (tier === 0) return;
    // Lit windows all round: nobody home, everything ready.
    const count = tier === 1 ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const pane = mesh(new THREE.BoxGeometry(0.22, 0.4, 0.05), windowLight);
      pane.position.set(
        Math.cos(angle) * (top + 0.02),
        y + height * 0.55,
        Math.sin(angle) * (top + 0.02),
      );
      pane.rotation.y = -angle + Math.PI / 2;
      pane.castShadow = false;
      root.add(pane);
    }
    const ledge = mesh(new THREE.CylinderGeometry(top + 0.15, top + 0.15, 0.08, 16), verdigris);
    ledge.position.y = y + height;
    root.add(ledge);
  });
  const spire = mesh(new THREE.ConeGeometry(0.4, 2.6, 8), stone);
  spire.position.y = 3.7 + 1.3;
  const beacon = mesh(new THREE.SphereGeometry(0.14, 10, 8), glow);
  beacon.position.y = 6.4;
  root.add(spire, beacon);
  glow.emissiveIntensity = 1.5;
  return { root, glow, animate: () => {} };
}

const podHull = new THREE.MeshStandardMaterial({
  color: "#e9edf3",
  metalness: 0.3,
  roughness: 0.25,
});
const scorch = new THREE.MeshStandardMaterial({ color: "#241a18", roughness: 1 });

/** The Culture supply pod: a smooth white capsule, half buried in its own crater. */
function pod(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  glow.emissive.set("#7fe8ff");
  const crater = mesh(new THREE.CylinderGeometry(1.6, 1.2, 0.12, 20), scorch);
  crater.position.y = 0.02;
  const body = mesh(new THREE.CapsuleGeometry(0.62, 1.3, 8, 20), podHull);
  body.rotation.z = Math.PI / 2 - 0.35;
  body.position.y = 0.45;
  const seam = mesh(new THREE.TorusGeometry(0.63, 0.03, 8, 32), glow);
  seam.rotation.y = Math.PI / 2;
  seam.rotation.x = 0.35;
  seam.position.y = 0.45;
  const hatch = new THREE.Group();
  const lid = mesh(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), podHull);
  hatch.add(lid);
  hatch.position.set(0.85, 0.75, 0);
  hatch.rotation.z = -1.2;
  root.add(crater, body, seam, hatch);
  return {
    root,
    glow,
    animate: (time, life) => {
      // Once unloaded, the hatch swings open.
      hatch.rotation.z = -1.2 + life * 1.1;
      seam.scale.setScalar(1 + Math.sin(time * 2) * 0.02);
    },
  };
}

/** The Tessilend transmitter: a tall mast of stacked rings under a dish that turns once woken. */
function transmitter(): SiteModel {
  const root = new THREE.Group();
  const glow = glowMaterial();
  const base = mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 8), darkStone);
  base.position.y = 0.2;
  const mast = mesh(new THREE.CylinderGeometry(0.16, 0.3, 4.2, 8), stone);
  mast.position.y = 2.4;
  root.add(base, mast);
  const rings = [0, 1, 2, 3].map((i) => {
    const ring = mesh(new THREE.TorusGeometry(0.5 - i * 0.07, 0.05, 6, 24), glow);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2 + i * 0.85;
    root.add(ring);
    return ring;
  });
  const dish = new THREE.Group();
  const bowl = mesh(
    new THREE.SphereGeometry(0.9, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3),
    verdigris,
  );
  bowl.rotation.x = Math.PI;
  bowl.position.y = 0.45;
  const feed = mesh(new THREE.ConeGeometry(0.08, 0.6, 8), glow);
  feed.position.y = 0.2;
  dish.add(bowl, feed);
  dish.position.y = 4.6;
  dish.rotation.z = 0.5;
  root.add(dish);
  return {
    root,
    glow,
    animate: (time, life) => {
      dish.rotation.y = time * 0.3 * life;
      rings.forEach((ring, i) => {
        ring.scale.setScalar(1 + life * Math.sin(time * 3 - i) * 0.12);
      });
    },
  };
}

const BUILDERS: Record<SiteKind, () => SiteModel> = {
  pod,
  transmitter,
  marker,
  archive,
  tap,
  fabricator,
  seedbed,
  habitat,
};

interface SiteView {
  model: SiteModel;
  /** Eases from 0 (dormant) to 1 (awake). */
  life: number;
}

/** Draws the sites the player has found. */
export class RuinView {
  readonly group = new THREE.Group();
  private readonly views = new Map<Site, SiteView>();
  private readonly studyRing: THREE.Mesh;
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: GLOW,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });

  constructor(private readonly world: World) {
    this.studyRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2),
      this.ringMaterial,
    );
    this.studyRing.visible = false;
  }

  /** The sites drawn this frame, for picking. */
  readonly shown: Site[] = [];

  update(sites: readonly Site[], time: number, dt: number): void {
    this.shown.length = 0;
    const visible = new Set<Site>();
    const rings: Site[] = [];
    for (const site of sites) {
      // A site is drawn once any of it has been seen.
      if (!site.footprint.some(([x, y]) => this.world.isExplored(gridRef(x, y)))) continue;
      visible.add(site);
      this.shown.push(site);
      let view = this.views.get(site);
      if (!view) {
        const model = BUILDERS[site.kind]();
        const ground = Math.max(
          ...site.footprint.map(([x, y]) => this.world.heightAt(x + 0.5, y + 0.5)),
        );
        model.root.position.set(site.center.x, ground, site.center.y);
        // Each site faces its own way: the builders had no single grid.
        model.root.rotation.y = ((site.x * 37 + site.y * 11) % 4) * (Math.PI / 2);
        this.group.add(model.root);
        view = { model, life: site.status === "awake" ? 1 : 0 };
        this.views.set(site, view);
      }
      view.model.root.visible = true;
      const target = site.status === "awake" ? 1 : 0;
      view.life += (target - view.life) * Math.min(1, dt * 0.8);
      view.model.animate(time, view.life);

      const { glow } = view.model;
      if (site.kind !== "habitat") {
        if (site.status === "awaiting") {
          glow.emissive.copy(WAITING);
          glow.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.3;
        } else {
          glow.emissive.copy(GLOW);
          const studying = site.status === "studying" ? 0.5 + Math.sin(time * 5) * 0.3 : 0;
          glow.emissiveIntensity = 0.15 + studying + view.life * 2.2;
        }
      }
      if (site.status === "studying") rings.push(site);
    }
    for (const [site, view] of this.views) if (!visible.has(site)) view.model.root.visible = false;

    // A ring marks the site being studied (the first, if there are several).
    const studied = rings[0];
    this.studyRing.visible = studied !== undefined;
    if (studied) {
      if (!this.studyRing.parent) this.group.add(this.studyRing);
      const ground = this.world.heightAt(studied.center.x, studied.center.y);
      this.studyRing.position.set(studied.center.x, ground + 0.06, studied.center.y);
      this.studyRing.scale.setScalar(studied.size * 0.75 + 0.6 + Math.sin(time * 4) * 0.05);
    }
  }

  /** The drawn site whose structure a ray passes through, nearest first. */
  pick(ray: THREE.Ray): Site | null {
    let best: Site | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const hit = new THREE.Vector3();
    for (const site of this.shown) {
      const ground = this.world.heightAt(site.center.x, site.center.y);
      const height =
        site.kind === "habitat" || site.kind === "transmitter"
          ? 2.5
          : site.kind === "marker"
            ? 0.7
            : 0.9;
      const sphere = new THREE.Sphere(
        new THREE.Vector3(site.center.x, ground + height, site.center.y),
        Math.max(0.6, site.size * 0.62),
      );
      if (ray.intersectSphere(sphere, hit)) {
        const d = hit.distanceTo(ray.origin);
        if (d < bestDistance) {
          best = site;
          bestDistance = d;
        }
      }
    }
    return best;
  }
}
