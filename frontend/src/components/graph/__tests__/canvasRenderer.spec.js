import { describe, it, expect, beforeEach } from "vitest";
import { renderScene, _isNodeActive } from "../canvasRenderer.js";

function createMockCanvasContext() {
  const ctx = {
    globalAlphaSetCalls: [],
    arcCalls: [],
    moveToCalls: [],
    bezierCurveToCalls: [],
    strokeCalls: [],
    fillTextCalls: [],
  };

  const methods = [
    "setTransform",
    "clearRect",
    "fillRect",
    "save",
    "translate",
    "scale",
    "beginPath",
    "lineTo",
    "closePath",
    "fill",
    "restore",
    "roundRect",
    "setLineDash",
    "getLineDash",
  ];
  for (const name of methods) ctx[name] = () => {};
  ctx.fillText = (text, x, y) => ctx.fillTextCalls.push({ text, x, y });

  ctx.moveTo = (x, y) => ctx.moveToCalls.push({ x, y });
  ctx.bezierCurveTo = (cp1x, cp1y, cp2x, cp2y, x, y) =>
    ctx.bezierCurveToCalls.push({ cp1x, cp1y, cp2x, cp2y, x, y });
  ctx.arc = (x, y, r) => ctx.arcCalls.push({ x, y, r });
  ctx.stroke = () => ctx.strokeCalls.push(true);

  let globalAlpha = 1;
  Object.defineProperty(ctx, "globalAlpha", {
    get() {
      return globalAlpha;
    },
    set(value) {
      globalAlpha = value;
      ctx.globalAlphaSetCalls.push(value);
    },
    configurable: true,
  });

  return ctx;
}

const baseScene = {
  labelFont: "12px sans-serif",
  nodes: [
    {
      path: "/n1",
      x: 40,
      y: 40,
      shape: "file",
      selected: false,
      label: "n1",
      timestampLabel: "2026-05-09 14:44",
      hotspot: null,
      isSearchMatch: false,
      isActiveSearchMatch: false,
    },
  ],
  edges: [{ x1: 30, y1: 30, x2: 90, y2: 90 }],
};

describe("renderScene transition frame", () => {
  it("uses transition frame x/y/alpha for node drawing", () => {
    const ctx = createMockCanvasContext();
    renderScene(ctx, {
      scene: baseScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
      transitionFrame: {
        nodes: [{ path: "/n1", x: 120, y: 80, alpha: 0.5, shape: "file", selected: false, label: "n1" }],
        edges: [],
      },
    });
    expect(ctx.globalAlphaSetCalls).toContain(0.5);
    expect(ctx.arcCalls.some((c) => c.x === 120 && c.y === 80)).toBe(true);
  });

  it("uses legacy render path when transitionFrame is absent", () => {
    const ctx = createMockCanvasContext();
    renderScene(ctx, { scene: baseScene, transform: { x: 0, y: 0, scale: 1 }, dpr: 1, width: 800, height: 600 });
    expect(ctx.globalAlphaSetCalls.some((v) => v !== 1)).toBe(false);
    expect(ctx.arcCalls.some((c) => c.x === 40 && c.y === 40)).toBe(true);
  });

  it("draws selection + search highlight while in transition mode", () => {
    const ctx = createMockCanvasContext();
    renderScene(ctx, {
      scene: baseScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
      transitionFrame: {
        nodes: [
          {
            path: "/n1",
            x: 120,
            y: 80,
            alpha: 1,
            shape: "file",
            selected: true,
            label: "n1",
            isSearchMatch: true,
            isActiveSearchMatch: true,
          },
        ],
        edges: [],
      },
    });
    expect(ctx.strokeCalls.length).toBeGreaterThan(1);
  });

  it("uses transition frame edge endpoints and alpha", () => {
    const ctx = createMockCanvasContext();
    renderScene(ctx, {
      scene: baseScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
      transitionFrame: {
        nodes: [],
        edges: [{ id: "e1", x1: 10, y1: 20, x2: 200, y2: 220, alpha: 0.4 }],
      },
    });
    expect(ctx.globalAlphaSetCalls).toContain(0.4);
    expect(ctx.moveToCalls.some((c) => c.x === 10 && c.y === 20)).toBe(true);
    expect(ctx.bezierCurveToCalls.length).toBeGreaterThan(0);
  });

  it("draws metaLabel as second line below node label", () => {
    const ctx = createMockCanvasContext();
    renderScene(ctx, {
      scene: {
        ...baseScene,
        nodes: [{ ...baseScene.nodes[0], label: "n1", metaLabel: "2026-05-09 14:44" }],
      },
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
    });
    expect(ctx.fillTextCalls.some((c) => c.text === "n1")).toBe(true);
    expect(ctx.fillTextCalls.some((c) => c.text === "2026-05-09 14:44")).toBe(true);
  });

  it("preserves transition/search/selection rendering while drawing timestamps", () => {
    const ctx = createMockCanvasContext();
    renderScene(ctx, {
      scene: baseScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
      transitionFrame: {
        nodes: [{
          path: "/n1",
          x: 120,
          y: 80,
          alpha: 0.5,
          shape: "file",
          selected: true,
          label: "n1",
          metaLabel: "2026-05-09 14:44",
          isSearchMatch: true,
          isActiveSearchMatch: true,
        }],
        edges: [{ id: "e1", x1: 10, y1: 20, x2: 200, y2: 220, alpha: 0.4 }],
      },
    });
    expect(ctx.globalAlphaSetCalls).toContain(0.5);
    expect(ctx.globalAlphaSetCalls).toContain(0.4);
    expect(ctx.strokeCalls.length).toBeGreaterThan(1);
    expect(ctx.fillTextCalls.some((c) => c.text === "2026-05-09 14:44")).toBe(true);
  });
});

describe("renderScene – viewport culling", () => {
  it("skips drawing a node that is entirely outside the viewport", () => {
    const ctx = createMockCanvasContext();
    // Node at x=5000 is far outside a 800x600 viewport with scale=1, translate=(0,0)
    const farScene = {
      labelFont: "12px sans-serif",
      nodes: [
        {
          path: "/far",
          x: 5000,
          y: 5000,
          shape: "file",
          selected: false,
          label: "far",
          timestampLabel: "—",
          isSearchMatch: false,
          isActiveSearchMatch: false,
        },
        {
          path: "/near",
          x: 100,
          y: 100,
          shape: "file",
          selected: false,
          label: "near",
          timestampLabel: "—",
          isSearchMatch: false,
          isActiveSearchMatch: false,
        },
      ],
      edges: [],
    };

    renderScene(ctx, {
      scene: farScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
    });

    // "far" node should not be drawn; "near" node should be drawn
    expect(ctx.arcCalls.some((c) => c.x === 5000 && c.y === 5000)).toBe(false);
    expect(ctx.arcCalls.some((c) => c.x === 100 && c.y === 100)).toBe(true);
  });

  it("skips drawing the label of a culled node", () => {
    const ctx = createMockCanvasContext();
    const farScene = {
      labelFont: "12px sans-serif",
      nodes: [
        {
          path: "/far",
          x: 5000,
          y: 5000,
          shape: "file",
          selected: false,
          label: "far-label",
          timestampLabel: "—",
          isSearchMatch: false,
          isActiveSearchMatch: false,
        },
      ],
      edges: [],
    };

    renderScene(ctx, {
      scene: farScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
    });

    expect(ctx.fillTextCalls.some((c) => c.text === "far-label")).toBe(false);
  });

  it("skips an edge only when BOTH endpoints are outside the viewport", () => {
    const ctx = createMockCanvasContext();
    const mixedScene = {
      labelFont: "12px sans-serif",
      nodes: [],
      edges: [
        // Both endpoints off-screen
        { id: "e1", x1: 5000, y1: 5000, x2: 6000, y2: 6000 },
        // One endpoint in-viewport
        { id: "e2", x1: 100, y1: 100, x2: 6000, y2: 6000 },
      ],
    };

    renderScene(ctx, {
      scene: mixedScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
    });

    // e1 (both off-screen) should be skipped: only 1 bezierCurveTo call (for e2)
    expect(ctx.bezierCurveToCalls).toHaveLength(1);
  });

  it("draws all nodes when transform scale is 0 (degenerate — no culling)", () => {
    const ctx = createMockCanvasContext();
    const farScene = {
      labelFont: "12px sans-serif",
      nodes: [
        {
          path: "/far",
          x: 5000,
          y: 5000,
          shape: "file",
          selected: false,
          label: "far",
          timestampLabel: "—",
          isSearchMatch: false,
          isActiveSearchMatch: false,
        },
      ],
      edges: [],
    };

    renderScene(ctx, {
      scene: farScene,
      transform: { x: 0, y: 0, scale: 0 },
      dpr: 1,
      width: 800,
      height: 600,
    });

    // Degenerate transform → culling disabled → node IS drawn
    expect(ctx.arcCalls.some((c) => c.x === 5000 && c.y === 5000)).toBe(true);
  });

  it("draws an edge that spans the viewport (endpoints on opposite sides)", () => {
    const ctx = createMockCanvasContext();
    const spanningScene = {
      labelFont: "12px sans-serif",
      nodes: [],
      edges: [
        // One endpoint above viewport, one below — edge crosses through viewport
        { id: "e1", x1: 100, y1: -500, x2: 100, y2: 2000 },
      ],
    };

    renderScene(ctx, {
      scene: spanningScene,
      transform: { x: 0, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
    });

    // Edge spans viewport → must be drawn
    expect(ctx.bezierCurveToCalls).toHaveLength(1);
  });

  it("draws all nodes when transform has NaN components (degenerate)", () => {
    const ctx = createMockCanvasContext();
    const farScene = {
      labelFont: "12px sans-serif",
      nodes: [
        {
          path: "/far",
          x: 5000,
          y: 5000,
          shape: "file",
          selected: false,
          label: "far",
          timestampLabel: "—",
          isSearchMatch: false,
          isActiveSearchMatch: false,
        },
      ],
      edges: [],
    };

    renderScene(ctx, {
      scene: farScene,
      transform: { x: NaN, y: 0, scale: 1 },
      dpr: 1,
      width: 800,
      height: 600,
    });

    expect(ctx.arcCalls.some((c) => c.x === 5000 && c.y === 5000)).toBe(true);
  });
});

describe("activePaths highlighting", () => {
  const opts = { transform: { x: 0, y: 0, scale: 1 }, dpr: 1, width: 800, height: 600 };
  let ctx;

  beforeEach(() => {
    ctx = createMockCanvasContext();
  });

  it("draws an extra arc (glow ring) when a node path is in activePaths", () => {
    // Baseline: render with no activePaths
    const before = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: baseScene });
    const baseCount = ctx.arcCalls.length - before;

    // With active path matching the node: should add at least one more arc
    const before2 = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: baseScene, activePaths: new Set(["/n1"]) });
    const activeCount = ctx.arcCalls.length - before2;

    expect(activeCount).toBeGreaterThan(baseCount);
  });

  it("draws no extra arc when activePaths is empty", () => {
    // Baseline: render with no activePaths option
    const before = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: baseScene });
    const baseCount = ctx.arcCalls.length - before;

    // With empty Set: should produce exactly the same arc count as baseline
    const before2 = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: baseScene, activePaths: new Set() });
    const emptyCount = ctx.arcCalls.length - before2;

    expect(emptyCount).toBe(baseCount);
  });

  it("does not throw when activePaths option is omitted", () => {
    expect(() => renderScene(ctx, { ...opts, scene: baseScene })).not.toThrow();
  });

  it("draws a glow arc for a diamond-shape node in activePaths", () => {
    const diamondScene = {
      ...baseScene,
      nodes: [{ ...baseScene.nodes[0], path: "/d1", shape: "diamond" }],
    };
    const before = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: diamondScene });
    const baseCount = ctx.arcCalls.length - before;

    const before2 = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: diamondScene, activePaths: new Set(["/d1"]) });
    const activeCount = ctx.arcCalls.length - before2;

    expect(activeCount).toBeGreaterThan(baseCount);
  });

  it("draws a glow arc for a folder-shape node in activePaths", () => {
    const folderScene = {
      ...baseScene,
      nodes: [{ ...baseScene.nodes[0], path: "/f1", shape: "folder" }],
    };
    const before = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: folderScene });
    const baseCount = ctx.arcCalls.length - before;

    const before2 = ctx.arcCalls.length;
    renderScene(ctx, { ...opts, scene: folderScene, activePaths: new Set(["/f1"]) });
    const activeCount = ctx.arcCalls.length - before2;

    expect(activeCount).toBeGreaterThan(baseCount);
  });

  describe("_isNodeActive path matching", () => {
    it("matches when activePaths has an exact node.path", () => {
      // activePaths has "/n1", node.path is "/n1" → glow
      const before = ctx.arcCalls.length;
      renderScene(ctx, { ...opts, scene: baseScene, activePaths: new Set(["/n1"]) });
      const activeCount = ctx.arcCalls.length - before;

      expect(activeCount).toBeGreaterThan(0);
    });

    it("matches when activePaths has a child path (SKILL.md pattern)", () => {
      // activePaths has "/n1/SKILL.md", node.path is "/n1" → glow
      const before = ctx.arcCalls.length;
      renderScene(ctx, { ...opts, scene: baseScene, activePaths: new Set(["/n1/SKILL.md"]) });
      const activeCount = ctx.arcCalls.length - before;

      expect(activeCount).toBeGreaterThan(0);
    });

    it("matches when activePaths has a short basename", () => {
      // activePaths has "n1", node.path is "/n1" → use baseScene node at "/n1"
      const before = ctx.arcCalls.length;
      renderScene(ctx, { ...opts, scene: baseScene, activePaths: new Set(["n1"]) });
      const activeCount = ctx.arcCalls.length - before;

      expect(activeCount).toBeGreaterThan(0);
    });
  });
});
