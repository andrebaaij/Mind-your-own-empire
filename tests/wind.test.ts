import { describe, expect, it } from "vitest";
import { prevailingAngle, windAt } from "../src/game/wind";

describe("windAt", () => {
  it("always blows, never harder than a full gust", () => {
    for (let s = 0; s < 2000; s += 7) {
      const wind = windAt("lessuin", s);
      expect(wind.strength).toBeGreaterThanOrEqual(0.25);
      expect(wind.strength).toBeLessThanOrEqual(1);
      expect(Math.hypot(wind.x, wind.y)).toBeCloseTo(1);
    }
  });

  it("keeps to within about 25 degrees of the prevailing direction", () => {
    const prevailing = prevailingAngle("lessuin");
    for (let s = 0; s < 2000; s += 13) {
      const wind = windAt("lessuin", s);
      const off = Math.atan2(
        Math.sin(Math.atan2(wind.y, wind.x) - prevailing),
        Math.cos(Math.atan2(wind.y, wind.x) - prevailing),
      );
      expect(Math.abs(off)).toBeLessThan(0.45);
    }
  });

  it("is the same for the same world and time, and differs between worlds", () => {
    expect(windAt("1500", 42)).toEqual(windAt("1500", 42));
    expect(prevailingAngle("1500")).not.toBeCloseTo(prevailingAngle("lessuin"));
  });

  it("gusts: the strength changes over a few seconds", () => {
    const strengths = Array.from({ length: 60 }, (_, s) => windAt("1500", s).strength);
    expect(Math.max(...strengths) - Math.min(...strengths)).toBeGreaterThan(0.2);
  });
});
