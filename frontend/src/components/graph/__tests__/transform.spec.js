import { describe, it, expect } from "vitest";
import { MAX_SCALE, MIN_SCALE, clampScale, screenToScene, sceneToScreen, zoomAtPoint } from "../transform.js";

describe("transform helpers", () => {
  it("converts screen coordinates to scene with DPR", () => {
    const point = screenToScene({ x: 140, y: 90 }, { left: 0, top: 0 }, 2, { x: 40, y: 40, scale: 1 });
    expect(point).toEqual({ x: 100, y: 50 });
  });

  it("converts scene coordinates to screen", () => {
    expect(sceneToScreen({ x: 10, y: 20 }, { left: 5, top: 5 }, { x: 40, y: 10, scale: 2 })).toEqual({
      x: 65,
      y: 55,
    });
  });

  it("zooms around a focal scene point", () => {
    const next = zoomAtPoint({ x: 40, y: 40, scale: 1 }, 2, { x: 20, y: 10 });
    expect(next.scale).toBe(2);
    expect(next.x).toBe(20);
    expect(next.y).toBe(30);
  });

  it("clamps scale range", () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(100)).toBe(MAX_SCALE);
  });
});
