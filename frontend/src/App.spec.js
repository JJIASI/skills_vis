import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import App from "./App.vue";
import EditorPanel from "./components/EditorPanel.vue";
import ContextMenu from "./components/ContextMenu.vue";
// Note: do NOT import SkillsDrawer here — it doesn't exist yet in the red phase.
// Use data-test attribute selectors instead of findComponent(SkillsDrawer).

// Must use vi.hoisted so mock variables are available when vi.mock factory runs
const {
  mockGetSkills, mockCreateSkill, mockDeleteSkill,
  mockScanSkills, mockImportSkills, mockGetServerCwd, mockGetTree,
  mockStartUsageSession, mockStopUsageSession, mockListUsageSessions, mockOpenUsageStream,
} = vi.hoisted(() => ({
  mockGetSkills: vi.fn(),
  mockCreateSkill: vi.fn(),
  mockDeleteSkill: vi.fn(),
  mockScanSkills: vi.fn(),
  mockImportSkills: vi.fn(),
  mockGetServerCwd: vi.fn(),
  mockGetTree: vi.fn(),
  mockStartUsageSession: vi.fn(),
  mockStopUsageSession: vi.fn(),
  mockListUsageSessions: vi.fn(),
  mockOpenUsageStream: vi.fn(),
}));

vi.mock("./api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSkills: mockGetSkills,
    createSkill: mockCreateSkill,
    deleteSkill: mockDeleteSkill,
    getServerCwd: mockGetServerCwd,
    getTree: mockGetTree,
    startUsageSession: mockStartUsageSession,
    stopUsageSession: mockStopUsageSession,
    listUsageSessions: mockListUsageSessions,
    openUsageStream: mockOpenUsageStream,
  };
});

vi.mock("./api/skills_import.js", () => ({
  scanSkills: mockScanSkills,
  importSkills: mockImportSkills,
}));

beforeEach(() => {
  mockGetSkills.mockResolvedValue({ saved: [], starters: [] });
  mockCreateSkill.mockResolvedValue(undefined);
  mockDeleteSkill.mockResolvedValue(undefined);
  mockScanSkills.mockReset();
  mockImportSkills.mockReset();
  mockGetServerCwd.mockReset();
  mockGetTree.mockReset();
  mockStartUsageSession.mockResolvedValue({ session_id: "test-session-id" });
  mockStopUsageSession.mockResolvedValue({ ok: true });
  mockListUsageSessions.mockResolvedValue([]);
  mockOpenUsageStream.mockReturnValue({ close: vi.fn() });
});

const sampleTree = {
  name: "skills",
  path: "/tmp/skills",
  type: "folder",
  children: [
    { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
    { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
  ],
}

describe("App", () => {
  it("renders split layout before folder loaded", () => {
    const wrapper = mount(App);

    expect(wrapper.find('[data-test="toolbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="graph-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="editor-panel"]').exists()).toBe(true);
  });

  it("opens the shared context menu on graph node right click", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false }],
        },
      },
    })

    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      x: 120,
      y: 48,
    })
    await nextTick()

    expect(wrapper.findComponent(ContextMenu).props("visible")).toBe(true)
    expect(wrapper.findComponent(ContextMenu).props("node")).toMatchObject({ path: "/tmp/skills/README.md", type: "file" })
    expect(wrapper.findComponent(ContextMenu).props("x")).toBe(120)
    expect(wrapper.findComponent(ContextMenu).props("y")).toBe(48)
  })

  it("dispatches the save action from the editor toolbar through App.vue", async () => {
    const saveSelectedFile = vi.fn().mockResolvedValue()
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false }],
        },
        initialCurrentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
        initialSelectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        contextMenuActions: { saveSelectedFile },
      },
    })

    await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
    await wrapper.findComponent(EditorPanel).vm.setEditorContentForTest("# updated")
    await wrapper.find("[data-test='save']").trigger("click")
    expect(saveSelectedFile).toHaveBeenCalledWith("# updated")
  })

  it("routes delete from the editor panel through App.vue", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false }],
        },
        initialCurrentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
        initialSelectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        contextMenuActions: { deleteNode },
      },
    })

    await wrapper.find("[data-test='delete-file']").trigger("click")
    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNode).toHaveBeenCalledWith(
      { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
    )
  })

  it("routes folder delete from the editor panel through App.vue when a folder is selected", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] }],
        },
        initialSelectedNode: { name: "docs", path: "/tmp/skills/docs", type: "folder" },
        contextMenuActions: { deleteNode },
      },
    })

    await wrapper.find("[data-test='delete-folder']").trigger("click")
    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNode).toHaveBeenCalledWith({ name: "docs", path: "/tmp/skills/docs", type: "folder" })
  })

  it("routes copy-path from the shared context menu through App.vue", async () => {
    const copyPath = vi.fn().mockResolvedValue()
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false }],
        },
        contextMenuActions: { copyPath },
      },
    })

    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      x: 120,
      y: 48,
    })
    await nextTick()
    await wrapper.find("[data-test='copy-path']").trigger("click")
    expect(copyPath).toHaveBeenCalledWith("/tmp/skills/README.md")
  })

  it("routes folder copy-path from the shared context menu through App.vue", async () => {
    const copyPath = vi.fn().mockResolvedValue()
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] }],
        },
        contextMenuActions: { copyPath },
      },
    })

    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
      x: 120,
      y: 48,
    })
    await nextTick()
    await wrapper.find("[data-test='copy-path']").trigger("click")
    expect(copyPath).toHaveBeenCalledWith("/tmp/skills/docs")
  })

  it("routes rename and delete from the shared context menu through App.vue", async () => {
    const renameNode = vi.fn().mockResolvedValue()
    const deleteNode = vi.fn().mockResolvedValue()
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false }],
        },
        contextMenuActions: { renameNode, deleteNode },
      },
    })

    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      x: 120,
      y: 48,
    })
    await nextTick()
    await wrapper.find("[data-test='rename']").trigger("click")
    await wrapper.find("input[data-test='rename-input']").setValue("README-2.md")
    await wrapper.find("[data-test='rename-submit']").trigger("click")
    expect(renameNode).toHaveBeenCalledWith(
      { path: "/tmp/skills/README.md", name: "README.md", type: "file", is_skill: false },
      "README-2.md",
    )

    window.confirm = vi.fn(() => true)
    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      x: 120,
      y: 48,
    })
    await nextTick()
    await wrapper.find("[data-test='delete']").trigger("click")
    expect(deleteNode).toHaveBeenCalledWith(
      { path: "/tmp/skills/README.md", name: "README.md", type: "file", is_skill: false },
    )
  })

  it("routes new-file and new-folder actions from the shared context menu through App.vue", async () => {
    const createFileAtNode = vi.fn().mockResolvedValue()
    const createFolderAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(App, {
      props: {
        initialTree: {
          name: "skills",
          path: "/tmp/skills",
          type: "folder",
          children: [{ name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] }],
        },
        contextMenuActions: { createFileAtNode, createFolderAtNode },
      },
    })

    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
      x: 120,
      y: 48,
    })
    await nextTick()
    await wrapper.find("[data-test='new-file']").trigger("click")
    await wrapper.find("input[data-test='create-file-input']").setValue("draft.md")
    await wrapper.find("[data-test='create-file-submit']").trigger("click")
    expect(createFileAtNode).toHaveBeenCalledWith(
      { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
      "draft.md",
    )

    wrapper.findComponent({ name: "GraphPanel" }).vm.$emit("context-menu", {
      node: { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
      x: 120,
      y: 48,
    })
    await nextTick()
    await wrapper.find("[data-test='new-folder']").trigger("click")
    await wrapper.find("input[data-test='create-folder-input']").setValue("guides")
    await wrapper.find("[data-test='create-folder-submit']").trigger("click")
    expect(createFolderAtNode).toHaveBeenCalledWith(
      { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
      "guides",
    )
  })


  it("hides the context menu when Escape is pressed", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: sampleTree,
        initialSelectedNode: sampleTree.children[0],
      },
    })

    // Open context menu via right-click on a graph node
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" })
    graphPanel.vm.$emit("context-menu", {
      node: sampleTree.children[0],
      x: 100,
      y: 100,
    })
    await nextTick()

    const menu = wrapper.findComponent(ContextMenu)
    expect(menu.props("visible")).toBe(true)

    // Press Escape
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await nextTick()

    expect(menu.props("visible")).toBe(false)
  })

  it("hides the context menu when clicking outside it", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: sampleTree,
        initialSelectedNode: sampleTree.children[0],
      },
    })

    // Open context menu
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" })
    graphPanel.vm.$emit("context-menu", {
      node: sampleTree.children[0],
      x: 100,
      y: 100,
    })
    await nextTick()

    const menu = wrapper.findComponent(ContextMenu)
    expect(menu.props("visible")).toBe(true)

    // Click outside — on the document body (not inside the context menu)
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    await nextTick()

    expect(menu.props("visible")).toBe(false)
  })

  it("hides the context menu when outside click event fires", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: sampleTree,
        initialSelectedNode: sampleTree.children[0],
      },
    })

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" })
    graphPanel.vm.$emit("context-menu", {
      node: sampleTree.children[0],
      x: 100,
      y: 100,
    })
    await nextTick()

    const menu = wrapper.findComponent(ContextMenu)
    expect(menu.props("visible")).toBe(true)

    document.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await nextTick()

    expect(menu.props("visible")).toBe(false)
  })

  it("hides the context menu when ContextMenu emits close", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: sampleTree,
        initialSelectedNode: sampleTree.children[0],
      },
    })

    // Open context menu
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" })
    graphPanel.vm.$emit("context-menu", {
      node: sampleTree.children[0],
      x: 100,
      y: 100,
    })
    await nextTick()

    const menu = wrapper.findComponent(ContextMenu)
    expect(menu.props("visible")).toBe(true)

    // ContextMenu emits close (e.g. after an action completes)
    menu.vm.$emit("close")
    await nextTick()

    expect(menu.props("visible")).toBe(false)
  })

  it("does not accumulate listeners on repeated right-clicks", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: sampleTree,
        initialSelectedNode: sampleTree.children[0],
      },
    })
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" })

    // Open once
    graphPanel.vm.$emit("context-menu", { node: sampleTree.children[0], x: 100, y: 100 })
    await nextTick()

    // Open again without closing (simulates right-click while menu is already open)
    graphPanel.vm.$emit("context-menu", { node: sampleTree.children[0], x: 200, y: 200 })
    await nextTick()

    const menu = wrapper.findComponent(ContextMenu)
    expect(menu.props("visible")).toBe(true)

    // Single Escape should close the menu exactly once
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await nextTick()
    expect(menu.props("visible")).toBe(false)
  })
});

describe("Skills Drawer integration", () => {
  const SAVED = [{ id: 1, label: "My Skills", path: "/tmp/skills", is_available: true }];
  const STARTERS = [{ key: "copilot", name: "Copilot", path: "/home/.copilot/skills", already_added: false, is_available: true }];

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSkills.mockResolvedValue({ saved: SAVED, starters: STARTERS });
  });

  it("fetches drawer data on mount (boot-time fetch)", async () => {
    mount(App);
    await flushPromises();
    expect(mockGetSkills).toHaveBeenCalledOnce();
  });

  it("toolbar open-drawer event opens the drawer", async () => {
    const w = mount(App);
    await flushPromises();
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(false);
    await w.find("[data-test='open-drawer']").trigger("click");
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(true);
  });

  it("drawer close button closes the drawer", async () => {
    const w = mount(App);
    await flushPromises();
    await w.find("[data-test='open-drawer']").trigger("click");
    await w.find("[data-test='drawer-close']").trigger("click");
    await nextTick();
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(false);
  });

  it("opening the monitor drawer closes the skills drawer", async () => {
    const w = mount(App);
    await flushPromises();
    await w.find("[data-test='open-drawer']").trigger("click");
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(true);
    await w.find("[data-test='open-monitor']").trigger("click");
    await nextTick();
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(false);
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(true);
  });

  it("opening the skills drawer closes the monitor drawer", async () => {
    const w = mount(App);
    await flushPromises();
    await w.find("[data-test='open-monitor']").trigger("click");
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(true);
    await w.find("[data-test='open-drawer']").trigger("click");
    await nextTick();
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(false);
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(true);
  });

  it("boot-time fetch failure keeps workspace usable and surfaces error in drawer", async () => {
    mockGetSkills.mockRejectedValue(new Error("network error"));
    const w = mount(App);
    await flushPromises();
    // Toolbar still rendered — workspace is usable
    expect(w.find("[data-test='toolbar']").exists()).toBe(true);
    // Open the drawer to see the error
    await w.find("[data-test='open-drawer']").trigger("click");
    expect(w.find("[data-test='skills-drawer'] [data-test='drawer-retry']").exists()).toBe(true);
  });

  // App.vue uses inject('api', null) and passes it to useTree. Providing a mock api via
  // global.provide correctly intercepts the injected tree-loading function.
  it("selecting an available saved entry calls loadTree", async () => {
    const mockGetTree = vi.fn().mockResolvedValue({ name: "skills", path: "/tmp/skills", type: "folder", children: [] });
    const w = mount(App, { global: { provide: { api: { getTree: mockGetTree, getFile: vi.fn(), listUsageSessions: vi.fn().mockResolvedValue([]) } } } });
    await flushPromises();
    // Open the drawer first
    await w.find("[data-test='open-drawer']").trigger("click");
    await w.find("[data-test='select-skill-1']").trigger("click");
    await flushPromises();
    expect(mockGetTree).toHaveBeenCalledWith("/tmp/skills");
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(true);
  });

  it("failed saved-entry launch keeps the drawer open and surfaces error", async () => {
    const mockGetTree = vi.fn().mockRejectedValue(new Error("load failed"));
    const w = mount(App, { global: { provide: { api: { getTree: mockGetTree, getFile: vi.fn(), listUsageSessions: vi.fn().mockResolvedValue([]) } } } });
    await flushPromises();
    // Open the drawer first
    await w.find("[data-test='open-drawer']").trigger("click");
    await w.find("[data-test='select-skill-1']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(true);
    expect(w.find("[data-test='drawer-retry']").exists()).toBe(true);
  });

  it("add-starter submits { label: starter.name, path: starter.path } via createSkill", async () => {
    mockCreateSkill.mockResolvedValue({ id: 99, label: "Copilot", path: "/home/.copilot/skills", is_available: false });
    const w = mount(App);
    await flushPromises();
    // Open the drawer and expand the starter section first
    await w.find("[data-test='open-drawer']").trigger("click");
    await w.find("[data-test='starter-toggle']").trigger("click");
    await w.find("[data-test='add-starter-copilot']").trigger("click");
    await flushPromises();
    expect(mockCreateSkill).toHaveBeenCalledWith({ label: "Copilot", path: "/home/.copilot/skills" });
  });

  describe('panel resize UI', () => {
    it('renders the graph panel', () => {
      const wrapper = mount(App)
      expect(wrapper.find('[data-test="graph-panel"]').exists()).toBe(true)
    })

    it('renders the editor panel', () => {
      const wrapper = mount(App)
      expect(wrapper.find('[data-test="editor-panel"]').exists()).toBe(true)
    })

    it('renders the resize handle between panels', () => {
      const wrapper = mount(App)
      expect(wrapper.find('[data-test="resize-handle"]').exists()).toBe(true)
    })

    it('renders PanelHeader in graph panel', () => {
      const wrapper = mount(App)
      expect(wrapper.find('[data-test="graph-panel-header"]').exists()).toBe(true)
    })

    it('renders PanelHeader in editor panel', () => {
      const wrapper = mount(App)
      expect(wrapper.find('[data-test="editor-panel-header"]').exists()).toBe(true)
    })
  })
})

describe("context menu expand actions", () => {
  const folderTree = {
    name: "skills",
    path: "/tmp/skills",
    type: "folder",
    children: [
      { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
    ],
  };

  it("passes isExpanded=true when contextMenuNode folder is expanded", async () => {
    const wrapper = mount(App, {
      props: { initialTree: folderTree },
    });

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });

    // Expand the folder via a toggle event from GraphPanel
    graphPanel.vm.$emit("toggle", "/tmp/skills/docs");
    await nextTick();

    // Open context menu on the now-expanded folder
    graphPanel.vm.$emit("context-menu", {
      node: folderTree.children[0],
      x: 50,
      y: 50,
    });
    await nextTick();

    expect(wrapper.findComponent(ContextMenu).props("isExpanded")).toBe(true);
  });


  it("contextMenuActions.toggleExpand calls useTree toggleNode", async () => {
    const wrapper = mount(App, {
      props: { initialTree: folderTree },
    });

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("context-menu", {
      node: folderTree.children[0],
      x: 50,
      y: 50,
    });
    await nextTick();

    const menu = wrapper.findComponent(ContextMenu);
    expect(typeof menu.props("actions").toggleExpand).toBe("function");

    // Toggling should flip expanded state
    expect(wrapper.findComponent(ContextMenu).props("isExpanded")).toBe(false);
    menu.props("actions").toggleExpand("/tmp/skills/docs");
    await nextTick();
    expect(wrapper.findComponent(ContextMenu).props("isExpanded")).toBe(true);
  });

});

describe("graph transform ownership", () => {
  it("passes default transform to GraphPanel", () => {
    const wrapper = mount(App, { props: { initialTree: sampleTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    expect(graphPanel.props("transform")).toEqual({ x: 40, y: 40, scale: 1 });
  });

  it("updates transform from GraphPanel event", async () => {
    const wrapper = mount(App, { props: { initialTree: sampleTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("update:transform", { x: 99, y: 77, scale: 1.4 });
    await nextTick();

    expect(wrapper.findComponent({ name: "GraphPanel" }).props("transform")).toEqual({ x: 99, y: 77, scale: 1.4 });
  });

  it("keeps transform ownership stable during animated expand", async () => {
    const wrapper = mount(App, { props: { initialTree: sampleTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("update:transform", { x: 90, y: 70, scale: 1.3 });
    await nextTick();

    graphPanel.vm.$emit("toggle", "/tmp/skills/docs");
    await flushPromises();

    expect(wrapper.findComponent({ name: "GraphPanel" }).props("transform")).toEqual({ x: 90, y: 70, scale: 1.3 });
  });

  it("preserves reorder-by-mtime state", async () => {
    const wrapper = mount(App, { props: { initialTree: sampleTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("update:reorderByMtime", true);
    await nextTick();

    expect(wrapper.findComponent({ name: "GraphPanel" }).props("reorderByMtime")).toBe(true);
  });
});

describe("graph search state ownership", () => {
  const searchTree = {
    name: "skills",
    path: "/tmp/skills",
    type: "folder",
    children: [
      { name: "README.md", path: "/tmp/skills/README.md", type: "file" },
      {
        name: "docs",
        path: "/tmp/skills/docs",
        type: "folder",
        children: [{ name: "Guide.md", path: "/tmp/skills/docs/Guide.md", type: "file" }],
      },
    ],
  };

  it("computes name/path matches and auto-activates first match", async () => {
    const wrapper = mount(App, { props: { initialTree: searchTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });

    graphPanel.vm.$emit("update:searchQuery", "guide");
    await nextTick();

    const remounted = wrapper.findComponent({ name: "GraphPanel" });
    expect(remounted.props("searchMatches")).toEqual(["/tmp/skills/docs/Guide.md"]);
    expect(remounted.props("activeSearchPath")).toBe("/tmp/skills/docs/Guide.md");
  });

  it("preserves active match path across recomputation when still present", async () => {
    const wrapper = mount(App, { props: { initialTree: searchTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });

    // ".md" matches README.md (index 0) and Guide.md (index 1)
    graphPanel.vm.$emit("update:searchQuery", ".md");
    await nextTick();
    graphPanel.vm.$emit("next-search-match"); // advance to Guide.md
    await nextTick();
    graphPanel.vm.$emit("update:searchQuery", "guide"); // Guide.md still present — preserve it
    await nextTick();

    const remounted = wrapper.findComponent({ name: "GraphPanel" });
    expect(remounted.props("activeSearchPath")).toBe("/tmp/skills/docs/Guide.md");
  });

  it("wraps Enter/Shift+Enter navigation and keeps no-op on zero matches", async () => {
    const wrapper = mount(App, { props: { initialTree: searchTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });

    // ".md" matches [README.md, Guide.md]; active starts at index 0 = README.md
    graphPanel.vm.$emit("update:searchQuery", ".md");
    await nextTick();
    graphPanel.vm.$emit("next-search-match"); // → index 1 = Guide.md
    await nextTick();
    expect(wrapper.findComponent({ name: "GraphPanel" }).props("activeSearchPath")).toBe("/tmp/skills/docs/Guide.md");

    graphPanel.vm.$emit("prev-search-match"); // → index 0 = README.md
    await nextTick();
    expect(wrapper.findComponent({ name: "GraphPanel" }).props("activeSearchPath")).toBe("/tmp/skills/README.md");

    graphPanel.vm.$emit("update:searchQuery", "nomatch");
    await nextTick();
    const before = wrapper.findComponent({ name: "GraphPanel" }).props("activeSearchPath");
    graphPanel.vm.$emit("next-search-match");
    graphPanel.vm.$emit("prev-search-match");
    await nextTick();
    expect(wrapper.findComponent({ name: "GraphPanel" }).props("activeSearchPath")).toBe(before);
  });

  it("auto-expands folder paths while query has matches", async () => {
    const wrapper = mount(App, { props: { initialTree: searchTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });

    graphPanel.vm.$emit("update:searchQuery", "Guide.md");
    await nextTick();

    const expanded = wrapper.findComponent({ name: "GraphPanel" }).props("expanded");
    expect(expanded["/tmp/skills"]).toBe(true);
    expect(expanded["/tmp/skills/docs"]).toBe(true);
  });

  it("preserves search active path across animated expand", async () => {
    const wrapper = mount(App, { props: { initialTree: searchTree } });
    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });

    graphPanel.vm.$emit("update:searchQuery", "README");
    await nextTick();
    const before = wrapper.findComponent({ name: "GraphPanel" }).props("activeSearchPath");

    graphPanel.vm.$emit("toggle", "/tmp/skills/docs");
    await flushPromises();

    expect(wrapper.findComponent({ name: "GraphPanel" }).props("activeSearchPath")).toBe(before);
  });
});

describe("graph animation regressions", () => {
  it("keeps context menu open/close behavior with animation enabled", async () => {
    const wrapper = mount(App, {
      props: {
        initialTree: sampleTree,
        initialSelectedNode: sampleTree.children[1],
      },
    });

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("context-menu", { node: sampleTree.children[1], x: 100, y: 100 });
    await nextTick();
    expect(wrapper.findComponent(ContextMenu).props("visible")).toBe(true);

    graphPanel.vm.$emit("toggle", "/tmp/skills/docs");
    await flushPromises();

    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(wrapper.findComponent(ContextMenu).props("visible")).toBe(false);
  });
});

describe("Import Skills modal", () => {
  it("renders the Import Skills button in the toolbar", async () => {
    const w = mount(App);
    expect(w.find("[data-test='open-import']").exists()).toBe(true);
  });

  it("opens ImportSkillsModal when Import Skills button is clicked", async () => {
    const w = mount(App);
    await w.find("[data-test='open-import']").trigger("click");
    expect(w.find("[data-test='import-modal']").exists()).toBe(true);
  });

  it("closes ImportSkillsModal when close event is emitted", async () => {
    const w = mount(App);
    await w.find("[data-test='open-import']").trigger("click");
    expect(w.find("[data-test='import-modal']").exists()).toBe(true);
    await w.findComponent({ name: "ImportSkillsModal" }).vm.$emit("close");
    await w.vm.$nextTick();
    expect(w.find("[data-test='import-modal']").exists()).toBe(false);
  });

  it("calls loadTree with destination when imported event is emitted", async () => {
    const mockGetTree = vi.fn().mockResolvedValue({ name: "skills", path: "/graph/path", type: "folder", children: [] });
    const w = mount(App, { global: { provide: { api: { getTree: mockGetTree, getFile: vi.fn(), listUsageSessions: vi.fn().mockResolvedValue([]) } } } });
    await flushPromises();
    await w.find("[data-test='open-import']").trigger("click");
    await w.findComponent({ name: "ImportSkillsModal" }).vm.$emit("imported", {
      destination: "/graph/path",
      imported: ["brainstorming"],
      skipped: [],
    });
    await flushPromises();
    expect(mockGetTree).toHaveBeenCalledWith("/graph/path");
  });
});

describe("auto-load on mount", () => {
  it("calls getServerCwd on mount and loadTree with the returned path", async () => {
    const mockGetServerCwdApi = vi.fn().mockResolvedValue({ path: "/workspace/skills" });
    const mockGetTree = vi.fn().mockResolvedValue({ name: "skills", path: "/workspace/skills", type: "folder", children: [] });
    const w = mount(App, {
      global: {
        provide: {
          api: { getServerCwd: mockGetServerCwdApi, getTree: mockGetTree, getFile: vi.fn(), listUsageSessions: vi.fn().mockResolvedValue([]) },
        },
      },
    });
    await flushPromises();
    expect(mockGetServerCwdApi).toHaveBeenCalledOnce();
    expect(mockGetTree).toHaveBeenCalledWith("/workspace/skills");
  });

  it("silently ignores errors from getServerCwd", async () => {
    const mockGetServerCwdApi = vi.fn().mockRejectedValue(new Error("network error"));
    const w = mount(App, {
      global: {
        provide: {
          api: { getServerCwd: mockGetServerCwdApi, getTree: vi.fn(), getFile: vi.fn(), listUsageSessions: vi.fn().mockResolvedValue([]) },
        },
      },
    });
    await flushPromises();
    expect(w.find("[data-test='toolbar']").exists()).toBe(true);
  });

  it("passes current tree path to SkillsDrawer as activeRootPath", async () => {
    const mockGetServerCwdApi = vi.fn().mockResolvedValue({ path: "/server/cwd" });
    const mockGetTree = vi.fn().mockResolvedValue({ name: "cwd", path: "/server/cwd", type: "folder", children: [] });
    const w = mount(App, {
      global: {
        provide: {
          api: { getServerCwd: mockGetServerCwdApi, getTree: mockGetTree, getFile: vi.fn(), listUsageSessions: vi.fn().mockResolvedValue([]) },
        },
      },
    });
    await flushPromises();
    // Open the drawer to make SkillsDrawer visible
    await w.find("[data-test='open-drawer']").trigger("click");
    const drawer = w.findComponent({ name: "SkillsDrawer" });
    expect(drawer.props("activeRootPath")).toBe("/server/cwd");
  });
});

const sampleShallowTree = {
  name: "skills",
  path: "/tmp/skills",
  type: "folder",
  children_loaded: true,
  children: [
    { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
    {
      name: "deep-folder",
      path: "/tmp/skills/deep-folder",
      type: "folder",
      children: [],
      children_loaded: false,
    },
  ],
};

describe("App – lazy folder loading via handleToggle", () => {
  it("calls getTree(path, 1, false) when expanding a folder with children_loaded: false", async () => {
    mockGetTree.mockResolvedValue({
      name: "deep-folder",
      path: "/tmp/skills/deep-folder",
      type: "folder",
      children_loaded: true,
      children: [
        { name: "SKILL.md", path: "/tmp/skills/deep-folder/SKILL.md", type: "file", is_skill: true },
      ],
    });

    const wrapper = mount(App, { props: { initialTree: sampleShallowTree } });
    await flushPromises();

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("toggle", "/tmp/skills/deep-folder");
    await flushPromises();

    expect(mockGetTree).toHaveBeenCalledWith("/tmp/skills/deep-folder", 1, false);
  });

  it("does NOT call getTree when expanding a folder with children_loaded: true", async () => {
    const treeWithLoadedFolder = {
      ...sampleShallowTree,
      children: [
        {
          name: "loaded-folder",
          path: "/tmp/skills/loaded-folder",
          type: "folder",
          children: [],
          children_loaded: true,
        },
      ],
    };
    const wrapper = mount(App, { props: { initialTree: treeWithLoadedFolder } });
    await flushPromises();

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("toggle", "/tmp/skills/loaded-folder");
    await flushPromises();

    expect(mockGetTree).not.toHaveBeenCalled();
  });

  it("shows alert and does NOT expand folder when fetch fails", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockGetTree.mockRejectedValue(new Error("Network error"));

    const wrapper = mount(App, { props: { initialTree: sampleShallowTree } });
    await flushPromises();

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    graphPanel.vm.$emit("toggle", "/tmp/skills/deep-folder");
    await flushPromises();

    expect(alertSpy).toHaveBeenCalled();
    const expandedProp = graphPanel.props("expanded");
    expect(expandedProp["/tmp/skills/deep-folder"]).toBeFalsy();

    alertSpy.mockRestore();
  });
});

describe("Record button", () => {
  it("renders the record button in the toolbar", async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find('[data-test="record-btn"]').exists()).toBe(true);
  });

  it("starts a session when Record is clicked", async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('[data-test="record-btn"]').trigger("click");
    await flushPromises();
    expect(mockStartUsageSession).toHaveBeenCalledOnce();
  });

  it("stops the session when Record is clicked while recording", async () => {
    const wrapper = mount(App);
    await flushPromises();
    const btn = wrapper.find('[data-test="record-btn"]');
    await btn.trigger("click");   // start
    await flushPromises();
    await btn.trigger("click");   // stop
    await flushPromises();
    expect(mockStopUsageSession).toHaveBeenCalledWith("test-session-id");
  });

  it("resolves relative skill_path against graph root when expanding from live stream", async () => {
    let streamCallback;
    mockOpenUsageStream.mockImplementation((_, cb) => {
      streamCallback = cb;
      return { close: vi.fn() };
    });

    const tree = {
      name: "skills",
      path: "/tmp/skills",
      type: "folder",
      children: [
        { name: "docs", path: "/tmp/skills/docs", type: "folder", children: [] },
      ],
    };

    const wrapper = mount(App, { props: { initialTree: tree } });
    await flushPromises();

    await wrapper.find('[data-test="record-btn"]').trigger("click");
    await flushPromises();

    // Relative path — should be resolved to /tmp/skills/docs/SKILL.md
    streamCallback({ skill_name: "my-skill", skill_path: "docs/SKILL.md" });
    await flushPromises();

    const graphPanel = wrapper.findComponent({ name: "GraphPanel" });
    expect(graphPanel.props("expanded")["/tmp/skills/docs"]).toBe(true);
    // Resolved absolute path must be in activePaths so the graph glow fires
    expect(graphPanel.props("activePaths").has("/tmp/skills/docs/SKILL.md")).toBe(true);
  });
});

describe("Session Monitor Drawer integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSkills.mockResolvedValue({ saved: [], starters: [] });
    mockListUsageSessions.mockResolvedValue([]);
  });

  it("session-monitor-drawer opens when open-monitor is clicked", async () => {
    const w = mount(App);
    await flushPromises();
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(false);
    await w.find("[data-test='open-monitor']").trigger("click");
    await nextTick();
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(true);
  });

  it("session-monitor close button closes the drawer", async () => {
    const w = mount(App);
    await flushPromises();
    await w.find("[data-test='open-monitor']").trigger("click");
    await nextTick();
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(true);
    await w.find("[data-test='drawer-close']").trigger("click");
    await nextTick();
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(false);
  });

  it("sessions are fetched on mount via listUsageSessions", async () => {
    mockListUsageSessions.mockClear();
    const w = mount(App);
    await flushPromises();
    expect(mockListUsageSessions).toHaveBeenCalledOnce();
  });
});
