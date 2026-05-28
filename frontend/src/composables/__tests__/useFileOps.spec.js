import { describe, it, expect, vi, beforeEach } from "vitest"
import { ref } from "vue"
import { useFileOps } from "../../composables/useFileOps"

describe("useFileOps", () => {
  it("reloads the tree after save and delete operations", async () => {
    const api = {
      getFile: vi.fn().mockResolvedValue({ path: "/tmp/skills/README.md", kind: "text", content: "# start" }),
      saveFile: vi.fn().mockResolvedValue({ status: "ok" }),
      deleteFile: vi.fn().mockResolvedValue(),
      getTree: vi.fn().mockResolvedValue({ name: "skills", path: "/tmp/skills", type: "folder", children: [] }),
    }
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: (rootPath) => api.getTree(rootPath),
    })

    await fileOps.openFile("/tmp/skills/README.md")
    await fileOps.saveSelectedFile("# changed")
    await fileOps.deleteNode({ type: "file", path: "/tmp/skills/README.md" })

    expect(api.getTree).toHaveBeenNthCalledWith(1, "/tmp/skills")
    expect(api.getTree).toHaveBeenNthCalledWith(2, "/tmp/skills")
  })

  it("maps a 415 file-open response to a binary preview placeholder", async () => {
    const api = {
      getFile: vi.fn().mockRejectedValue({ status: 415 }),
    }
    const currentFile = ref(null)
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: vi.fn(),
      currentFile,
    })

    await fileOps.openFile("/tmp/skills/image.png")
    expect(currentFile.value).toEqual({ path: "/tmp/skills/image.png", kind: "binary", content: null })
  })

  it("dispatches folder deletes to api.deleteFolder and reloads the tree", async () => {
    const api = {
      deleteFolder: vi.fn().mockResolvedValue(),
      getTree: vi.fn().mockResolvedValue({ name: "skills", path: "/tmp/skills", type: "folder", children: [] }),
    }
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: (rootPath) => api.getTree(rootPath),
    })

    await fileOps.deleteNode({ type: "folder", path: "/tmp/skills/docs" })
    expect(api.deleteFolder).toHaveBeenCalledWith("/tmp/skills/docs")
    expect(api.getTree).toHaveBeenCalledWith("/tmp/skills")
  })

  it("dispatches folder renames with basename-only values and reloads the tree", async () => {
    const api = {
      renamePath: vi.fn().mockResolvedValue({ path: "/tmp/skills/guides", name: "guides" }),
      getTree: vi.fn().mockResolvedValue({ name: "skills", path: "/tmp/skills", type: "folder", children: [] }),
    }
    const selectedNode = ref({ type: "folder", path: "/tmp/skills/docs", name: "docs" })
    const currentFile = ref(null)
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: (rootPath) => api.getTree(rootPath),
      selectedNode,
      currentFile,
    })

    await fileOps.renameNode({ type: "folder", path: "/tmp/skills/docs", name: "docs" }, "guides")
    expect(api.renamePath).toHaveBeenCalledWith("/tmp/skills/docs", "guides")
    expect(api.getTree).toHaveBeenCalledWith("/tmp/skills")
    expect(selectedNode.value.path).toBe("/tmp/skills/guides")
    expect(selectedNode.value.name).toBe("guides")
  })

  it("retargets the selected file and current file after renaming that file", async () => {
    const api = {
      renamePath: vi.fn().mockResolvedValue({ path: "/tmp/skills/README-2.md", name: "README-2.md" }),
      getTree: vi.fn().mockResolvedValue({ name: "skills", path: "/tmp/skills", type: "folder", children: [] }),
    }
    const selectedNode = ref({ type: "file", path: "/tmp/skills/README.md", name: "README.md" })
    const currentFile = ref({ path: "/tmp/skills/README.md", kind: "text", content: "# start" })
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: (rootPath) => api.getTree(rootPath),
      selectedNode,
      currentFile,
    })

    await fileOps.renameNode({ type: "file", path: "/tmp/skills/README.md", name: "README.md" }, "README-2.md")
    expect(api.renamePath).toHaveBeenCalledWith("/tmp/skills/README.md", "README-2.md")
    expect(api.getTree).toHaveBeenCalledWith("/tmp/skills")
    expect(selectedNode.value.path).toBe("/tmp/skills/README-2.md")
    expect(selectedNode.value.name).toBe("README-2.md")
    expect(currentFile.value.path).toBe("/tmp/skills/README-2.md")
  })

  it("clears stale selected file state after deleting its parent folder", async () => {
    const api = { deleteFolder: vi.fn().mockResolvedValue(), getTree: vi.fn().mockResolvedValue({}) }
    const selectedNode = ref({ type: "file", path: "/tmp/skills/docs/guide.md", name: "guide.md" })
    const currentFile = ref({ path: "/tmp/skills/docs/guide.md", kind: "text", content: "# guide" })
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: () => api.getTree("/tmp/skills"),
      selectedNode,
      currentFile,
    })

    await fileOps.deleteNode({ type: "folder", path: "/tmp/skills/docs", name: "docs" })
    expect(selectedNode.value).toBe(null)
    expect(currentFile.value).toBe(null)
  })

  it("retargets descendant file state after renaming its parent folder", async () => {
    const api = { renamePath: vi.fn().mockResolvedValue({ path: "/tmp/skills/guides", name: "guides" }) }
    const selectedNode = ref({ type: "file", path: "/tmp/skills/docs/guide.md", name: "guide.md" })
    const currentFile = ref({ path: "/tmp/skills/docs/guide.md", kind: "text", content: "# guide" })
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: vi.fn(),
      selectedNode,
      currentFile,
    })

    await fileOps.renameNode({ type: "folder", path: "/tmp/skills/docs", name: "docs" }, "guides")
    expect(selectedNode.value.path).toBe("/tmp/skills/guides/guide.md")
    expect(selectedNode.value.name).toBe("guide.md")
    expect(currentFile.value.path).toBe("/tmp/skills/guides/guide.md")
  })

  it("creates files and folders beneath the targeted folder path and reloads the tree after each create", async () => {
    const api = {
      createFile: vi.fn().mockResolvedValue({ path: "/tmp/skills/docs/draft.md", name: "draft.md" }),
      createFolder: vi.fn().mockResolvedValue({ path: "/tmp/skills/docs/examples", name: "examples" }),
      getTree: vi.fn().mockResolvedValue({ name: "skills", path: "/tmp/skills", type: "folder", children: [] }),
    }
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: (rootPath) => api.getTree(rootPath),
    })

    await fileOps.createFileAtNode({ type: "folder", path: "/tmp/skills/docs" }, "draft.md")
    await fileOps.createFolderAtNode({ type: "folder", path: "/tmp/skills/docs" }, "examples")

    expect(api.createFile).toHaveBeenCalledWith("/tmp/skills/docs/draft.md", "")
    expect(api.createFolder).toHaveBeenCalledWith("/tmp/skills/docs/examples")
    expect(api.getTree).toHaveBeenNthCalledWith(1, "/tmp/skills")
    expect(api.getTree).toHaveBeenNthCalledWith(2, "/tmp/skills")
  })

  it("clears selection and current file after deleting the selected file", async () => {
    const api = { deleteFile: vi.fn().mockResolvedValue(), getTree: vi.fn().mockResolvedValue({}) }
    const selectedNode = ref({ type: "file", path: "/tmp/skills/README.md", name: "README.md" })
    const currentFile = ref({ path: "/tmp/skills/README.md", kind: "text", content: "# start" })
    const fileOps = useFileOps(api, {
      rootPath: ref("/tmp/skills"),
      reloadTree: () => api.getTree("/tmp/skills"),
      selectedNode,
      currentFile,
    })

    await fileOps.deleteNode(selectedNode.value)
    expect(selectedNode.value).toBe(null)
    expect(currentFile.value).toBe(null)
  })
})
