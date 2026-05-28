import { describe, it, expect } from "vitest";
import { buildScene } from "../sceneModel.js";

const tree = {
  name: "skills",
  path: "/skills",
  type: "folder",
  children: [
    {
      name: "folder",
      path: "/skills/folder",
      type: "folder",
      children: [{ name: "file.md", path: "/skills/folder/file.md", type: "file" }],
    },
    { name: "bad", type: "file" },
  ],
};

describe("buildScene", () => {
  it("builds visible nodes based on expanded map", () => {
    const collapsed = buildScene({ tree, expanded: { "/skills": true } });
    const expanded = buildScene({ tree, expanded: { "/skills": true, "/skills/folder": true } });
    expect(collapsed.status).toBe("ready");
    expect(collapsed.nodes.map((n) => n.path)).toEqual(["/skills", "/skills/folder"]);
    expect(expanded.nodes.map((n) => n.path)).toEqual(["/skills", "/skills/folder", "/skills/folder/file.md"]);
  });

  it("skips malformed descendants and errors malformed root", () => {
    const scene = buildScene({ tree, expanded: { "/skills": true } });
    expect(scene.nodes.find((n) => n.name === "bad")).toBeUndefined();
    expect(buildScene({ tree: { nope: true }, expanded: {} }).status).toBe("error");
  });

  it("guards against cycles by path", () => {
    const cyc = { name: "root", path: "/r", type: "folder", children: [] };
    cyc.children.push(cyc);
    const scene = buildScene({ tree: cyc, expanded: { "/r": true } });
    expect(scene.nodes).toHaveLength(1);
  });

  it("marks search match and active match flags while preserving selected state", () => {
    const scene = buildScene({
      tree,
      expanded: { "/skills": true, "/skills/folder": true },
      selectedPath: "/skills/folder/file.md",
      searchMatchPaths: ["/skills/folder", "/skills/folder/file.md"],
      activeSearchPath: "/skills/folder/file.md",
    });

    const folderNode = scene.nodes.find((node) => node.path === "/skills/folder");
    const fileNode = scene.nodes.find((node) => node.path === "/skills/folder/file.md");
    const rootNode = scene.nodes.find((node) => node.path === "/skills");

    expect(folderNode.isSearchMatch).toBe(true);
    expect(folderNode.isActiveSearchMatch).toBe(false);
    expect(fileNode.isSearchMatch).toBe(true);
    expect(fileNode.isActiveSearchMatch).toBe(true);
    expect(fileNode.selected).toBe(true);
    expect(rootNode.isSearchMatch).toBe(false);
    expect(rootNode.isActiveSearchMatch).toBe(false);
  });

  it("reorders children by mtime when reorderByMtime is true", () => {
    const treeWithMtime = {
      name: "root",
      path: "/root",
      type: "folder",
      mtime: 1000,
      children: [
        { name: "new.txt", path: "/root/new.txt", type: "file", mtime: 3000 },
        { name: "old.txt", path: "/root/old.txt", type: "file", mtime: 1000 },
        { name: "mid.txt", path: "/root/mid.txt", type: "file", mtime: 2000 },
      ],
    };

    const defaultOrder = buildScene({
      tree: treeWithMtime,
      expanded: { "/root": true },
      reorderByMtime: false,
    });

    const mtimeOrder = buildScene({
      tree: treeWithMtime,
      expanded: { "/root": true },
      reorderByMtime: true,
    });

    // Default order should be: root, new.txt, old.txt, mid.txt (original order)
    expect(defaultOrder.nodes.map((n) => n.name)).toEqual(["root", "new.txt", "old.txt", "mid.txt"]);

    // Mtime order should be: root, new.txt, mid.txt, old.txt (sorted by mtime descending)
    expect(mtimeOrder.nodes.map((n) => n.name)).toEqual(["root", "new.txt", "mid.txt", "old.txt"]);
  });
});

describe("buildScene – lazy loading", () => {
  const treeWithStub = {
    name: "skills",
    path: "/skills",
    type: "folder",
    children_loaded: true,
    children: [
      {
        name: "big-folder",
        path: "/skills/big-folder",
        type: "folder",
        children: [],
        children_loaded: false,
      },
    ],
  };

  it("sets hasUnloadedChildren: true on a folder stub (children_loaded: false)", () => {
    const scene = buildScene({ tree: treeWithStub, expanded: { "/skills": true } });
    const stub = scene.nodes.find((n) => n.path === "/skills/big-folder");
    expect(stub).toBeDefined();
    expect(stub.hasUnloadedChildren).toBe(true);
  });

  it("sets hasUnloadedChildren: false on a fully-loaded folder", () => {
    const scene = buildScene({ tree: treeWithStub, expanded: { "/skills": true } });
    const root = scene.nodes.find((n) => n.path === "/skills");
    expect(root.hasUnloadedChildren).toBe(false);
  });

  it("appends ' …' to label when path is in loadingPaths", () => {
    const paths = new Set(["/skills/big-folder"]);
    const scene = buildScene({
      tree: treeWithStub,
      expanded: { "/skills": true },
      loadingPaths: paths,
      measureText: () => 0,
    });
    const stub = scene.nodes.find((n) => n.path === "/skills/big-folder");
    expect(stub.label).toBe("big-folder \u2026");
  });

  it("does not append ' …' when path is not in loadingPaths", () => {
    const scene = buildScene({
      tree: treeWithStub,
      expanded: { "/skills": true },
      loadingPaths: new Set(),
    });
    const stub = scene.nodes.find((n) => n.path === "/skills/big-folder");
    expect(stub.label).not.toMatch(/\s…$/);
  });

  it("works correctly when loadingPaths is omitted (default behavior)", () => {
    const scene = buildScene({ tree: treeWithStub, expanded: { "/skills": true } });
    const stub = scene.nodes.find((n) => n.path === "/skills/big-folder");
    // No error thrown, label unchanged
    expect(stub.label).toBe("big-folder");
  });

  it("does not throw and shows no loading suffix when loadingPaths is not a Set", () => {
    const scene = buildScene({
      tree: treeWithStub,
      expanded: { "/skills": true },
      loadingPaths: ["/skills/big-folder"], // array, not Set
    });
    const stub = scene.nodes.find((n) => n.path === "/skills/big-folder");
    expect(stub.label).toBe("big-folder");  // no crash, no suffix
  });
});
