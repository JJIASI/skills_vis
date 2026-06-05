import { describe, it, expect } from "vitest";
import { collectSearchExpandPaths, collectSearchMatches, nextIndex, prevIndex } from "../search.js";

const tree = {
  name: "skills",
  path: "/tmp/skills",
  type: "folder",
  children: [
    { name: "README.md", path: "/tmp/skills/README.md", type: "file" },
    {
      name: "docs",
      path: "/tmp/skills/docs",
      type: "folder",
      children: [
        { name: "guide.md", path: "/tmp/skills/docs/guide.md", type: "file" },
        { name: "guide.md", path: "/tmp/skills/docs/guide-copy.md", type: "file" },
      ],
    },
  ],
};

describe("search helpers", () => {
  it("matches by name with case-insensitive substring", () => {
    expect(collectSearchMatches(tree, "read")).toEqual(["/tmp/skills/README.md"]);
    expect(collectSearchMatches(tree, "GUIDE")).toEqual([
      "/tmp/skills/docs/guide.md",
      "/tmp/skills/docs/guide-copy.md",
    ]);
  });

  it("trims query and returns empty for blank query", () => {
    expect(collectSearchMatches(tree, "  read  ")).toEqual(["/tmp/skills/README.md"]);
    expect(collectSearchMatches(tree, "   ")).toEqual([]);
  });

  it("includes root node in matching", () => {
    expect(collectSearchMatches(tree, "skills")).toContain("/tmp/skills");
  });

  it("keeps duplicate names distinct by path identity", () => {
    expect(collectSearchMatches(tree, "guide.md")).toEqual([
      "/tmp/skills/docs/guide.md",
      "/tmp/skills/docs/guide-copy.md",
    ]);
  });

  it("wraps next index", () => {
    expect(nextIndex(-1, 3)).toBe(0);
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 0)).toBe(-1);
  });

  it("wraps previous index", () => {
    expect(prevIndex(-1, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(0, 0)).toBe(-1);
  });

  it("collects folder paths to expand for matched descendants", () => {
    const matches = ["/tmp/skills/docs/guide.md"];
    expect(collectSearchExpandPaths(tree, matches)).toEqual(["/tmp/skills", "/tmp/skills/docs"]);
  });

  it("includes a matched folder itself in expansion paths", () => {
    const matches = ["/tmp/skills/docs"];
    expect(collectSearchExpandPaths(tree, matches)).toEqual(["/tmp/skills", "/tmp/skills/docs"]);
  });
});
