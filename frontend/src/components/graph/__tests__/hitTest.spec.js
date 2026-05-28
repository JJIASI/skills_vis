import { describe, it, expect } from "vitest";
import { hitTestScene } from "../hitTest.js";

const scene = {
  nodes: [
    {
      path: "/folder",
      shape: "folder",
      x: 0,
      y: 0,
      labelRect: { x1: -10, y1: 12, x2: 10, y2: 24 },
    },
    {
      path: "/file",
      shape: "file",
      x: 100,
      y: 0,
      labelRect: { x1: 90, y1: 12, x2: 110, y2: 24 },
    },
    {
      path: "/skill",
      shape: "diamond",
      x: 200,
      y: 0,
      labelRect: { x1: 190, y1: 12, x2: 210, y2: 24 },
    },
  ],
};

describe("hitTestScene", () => {
  it("detects folder/file/diamond bodies", () => {
    expect(hitTestScene(scene, { x: 0, y: 0 }).node.path).toBe("/folder");
    expect(hitTestScene(scene, { x: 100, y: 0 }).node.path).toBe("/file");
    expect(hitTestScene(scene, { x: 200, y: 0 }).node.path).toBe("/skill");
  });

  it("returns label hits and none when missed", () => {
    expect(hitTestScene(scene, { x: 0, y: 16 }).kind).toBe("label");
    expect(hitTestScene(scene, { x: 500, y: 500 }).kind).toBe("none");
  });
});
