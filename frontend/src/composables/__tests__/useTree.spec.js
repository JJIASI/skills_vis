import { describe, it, expect, vi } from "vitest";
import { useTree } from "../../composables/useTree.js";

describe("useTree", () => {
  it("stores loaded root path and tree payload", async () => {
    const mockTree = {
      name: "skills",
      path: "/tmp/skills",
      type: "folder",
      children: [],
    };
    const api = { getTree: vi.fn().mockResolvedValue(mockTree) };

    const { rootPath, tree, loadTree } = useTree(api);
    await loadTree("/tmp/skills");

    expect(api.getTree).toHaveBeenCalledWith("/tmp/skills");
    expect(rootPath.value).toBe("/tmp/skills");
    expect(tree.value.path).toBe("/tmp/skills");
  });
});

const nestedTree = {
  name: "skills",
  path: "/skills",
  type: "folder",
  children: [
    {
      name: "btc-model",
      path: "/skills/btc-model",
      type: "folder",
      children: [
        {
          name: "SKILL.md",
          path: "/skills/btc-model/SKILL.md",
          type: "file",
          is_skill: true,
        },
        {
          name: "sub",
          path: "/skills/btc-model/sub",
          type: "folder",
          children: [],
        },
      ],
    },
    {
      name: "README.md",
      path: "/skills/README.md",
      type: "file",
    },
  ],
};

describe("useTree – expandAll", () => {
  it("expands the target folder and all descendant folders", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { tree, loadTree, expanded, expandAll } = useTree(api);
    await loadTree("/skills");

    expandAll("/skills");

    expect(expanded.value["/skills"]).toBe(true);
    expect(expanded.value["/skills/btc-model"]).toBe(true);
    expect(expanded.value["/skills/btc-model/sub"]).toBe(true);
  });

  it("does not add file paths to expanded map", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { tree, loadTree, expanded, expandAll } = useTree(api);
    await loadTree("/skills");

    expandAll("/skills");

    expect(expanded.value["/skills/README.md"]).toBeUndefined();
    expect(expanded.value["/skills/btc-model/SKILL.md"]).toBeUndefined();
  });

  it("is a no-op when path does not exist in tree", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { tree, loadTree, expanded, expandAll } = useTree(api);
    await loadTree("/skills");

    expandAll("/does-not-exist");

    expect(Object.keys(expanded.value)).toHaveLength(0);
  });

  it("is a no-op when called on a file path", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { loadTree, expanded, expandAll } = useTree(api);
    await loadTree("/skills");

    expandAll("/skills/README.md");

    expect(Object.keys(expanded.value)).toHaveLength(0);
  });
});

describe("useTree – toggleNode collapse clears descendants", () => {
  it("clears descendant expanded state when collapsing a folder", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { loadTree, expanded, expandAll, toggleNode } = useTree(api);
    await loadTree("/skills");

    // Expand all so descendants are in the map
    expandAll("/skills");
    expect(expanded.value["/skills/btc-model/sub"]).toBe(true);

    // Collapse /skills/btc-model
    toggleNode("/skills/btc-model");
    expect(expanded.value["/skills/btc-model"]).toBe(false);

    // Descendant should be cleared
    expect(expanded.value["/skills/btc-model/sub"]).toBeFalsy();
  });

  it("re-expanding a collapsed folder shows only 1 level deep", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { loadTree, expanded, expandAll, toggleNode } = useTree(api);
    await loadTree("/skills");

    // Expand all, then collapse /skills/btc-model, then re-expand it
    expandAll("/skills");
    toggleNode("/skills/btc-model"); // collapse → descendants cleared
    toggleNode("/skills/btc-model"); // re-expand

    expect(expanded.value["/skills/btc-model"]).toBe(true);
    // Descendant sub-folder should NOT be expanded (only 1 level shown)
    expect(expanded.value["/skills/btc-model/sub"]).toBeFalsy();
  });

  it("does not affect sibling or parent expanded state when collapsing", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(nestedTree) };
    const { loadTree, expanded, expandAll, toggleNode } = useTree(api);
    await loadTree("/skills");

    expandAll("/skills");
    toggleNode("/skills/btc-model"); // collapse a child

    // Root and siblings unaffected
    expect(expanded.value["/skills"]).toBe(true);
  });
});

describe("useTree – graftChildren", () => {
  const shallowTree = {
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

  it("populates children and sets children_loaded: true on the target node", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(shallowTree) };
    const { loadTree, tree, graftChildren } = useTree(api);
    await loadTree("/skills");

    const fetchedChildren = [
      { name: "SKILL.md", path: "/skills/big-folder/SKILL.md", type: "file", is_skill: true },
    ];
    graftChildren("/skills/big-folder", fetchedChildren);

    const bigFolder = tree.value.children.find((n) => n.path === "/skills/big-folder");
    expect(bigFolder.children).toHaveLength(1);
    expect(bigFolder.children[0].name).toBe("SKILL.md");
    expect(bigFolder.children_loaded).toBe(true);
  });

  it("is a no-op when path does not exist in tree", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(shallowTree) };
    const { loadTree, tree, graftChildren } = useTree(api);
    await loadTree("/skills");

    // Should not throw
    graftChildren("/skills/does-not-exist", []);

    // Tree is unchanged
    expect(tree.value.children).toHaveLength(1);
  });
});

describe("useTree – findTreeNode", () => {
  const simpleTree = {
    name: "skills",
    path: "/skills",
    type: "folder",
    children: [
      { name: "README.md", path: "/skills/README.md", type: "file" },
    ],
  };

  it("returns the node matching the given path", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(simpleTree) };
    const { loadTree, findTreeNode } = useTree(api);
    await loadTree("/skills");

    const node = findTreeNode("/skills/README.md");
    expect(node).not.toBeNull();
    expect(node.name).toBe("README.md");
  });

  it("returns null when path is not in the tree", async () => {
    const api = { getTree: vi.fn().mockResolvedValue(simpleTree) };
    const { loadTree, findTreeNode } = useTree(api);
    await loadTree("/skills");

    expect(findTreeNode("/skills/missing")).toBeNull();
  });

  it("returns null when tree is not loaded", () => {
    const api = { getTree: vi.fn() };
    const { findTreeNode } = useTree(api);

    expect(findTreeNode("/skills")).toBeNull();
  });
});
