/**
 * Things that happen in the game that the player should see or hear: the simulation records
 * them, and each frame the effects and the sound pick them up and clear the list. The
 * simulation never waits on them, so tests can ignore them entirely.
 */

import type { Point } from "./coords";
import type { ObjectName } from "./definitions";
import type { ResourceKind } from "./world";

export type GameEvent =
  /** A drone chipped a piece off a deposit. */
  | { kind: "mined"; at: Point; resource: ResourceKind }
  /** A load handed over at the Mind. */
  | { kind: "delivered"; at: Point; resource: ResourceKind; amount: number }
  | { kind: "built"; at: Point; name: ObjectName }
  /** Something left the map, and why. */
  | {
      kind: "removed";
      at: Point;
      name: ObjectName;
      why: "tidied" | "evicted" | "smashed" | "wrecked" | "escorted" | "left";
    }
  | { kind: "woke"; at: Point }
  | { kind: "ordered"; at: Point; order: "move" | "gather" | "study" }
  | { kind: "selected"; count: number }
  /** A line from the Mind, by tone (for the sound that goes with it). */
  | { kind: "said"; tone: "info" | "warning" | "success" }
  | { kind: "landed"; at: Point };

export function emit(target: { events: GameEvent[] }, event: GameEvent): void {
  // Nobody may be listening (tests, a paused tab); don't let the list grow without bound.
  if (target.events.length < 500) target.events.push(event);
}
