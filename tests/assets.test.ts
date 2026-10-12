import { describe, expect, it } from "vitest";
import { glowAmount } from "../src/game/assets";

describe("glowAmount", () => {
  it("lights up bright, saturated colours of the right hue", () => {
    expect(glowAmount(0.37, 0.88, 1, "cyan")).toBeGreaterThan(0.5);
    expect(glowAmount(1, 0.7, 0.28, "amber")).toBeGreaterThan(0.5);
    expect(glowAmount(1, 0.29, 0.16, "red")).toBeGreaterThan(0.5);
  });

  it("leaves greys, dark colours and other hues alone", () => {
    expect(glowAmount(0.8, 0.8, 0.8, "cyan")).toBe(0);
    expect(glowAmount(0.1, 0.3, 0.35, "cyan")).toBe(0);
    expect(glowAmount(1, 0.7, 0.28, "cyan")).toBe(0);
    expect(glowAmount(0.37, 0.88, 1, "red")).toBe(0);
  });

  it("finds red on both sides of the hue circle", () => {
    expect(glowAmount(1, 0.2, 0.3, "red")).toBeGreaterThan(0);
    expect(glowAmount(1, 0.3, 0.2, "red")).toBeGreaterThan(0);
  });
});
