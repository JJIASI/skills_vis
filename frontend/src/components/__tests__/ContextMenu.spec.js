import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import ContextMenu from "../ContextMenu.vue"

describe("ContextMenu", () => {
  it("opens inline folder-create inputs for the folder context action", async () => {
    const createFolderAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "folder", path: "/tmp/skills" }, actions: { createFolderAtNode } },
    })

    await wrapper.find("[data-test='new-folder']").trigger("click")
    expect(wrapper.find("input[data-test='create-folder-input']").exists()).toBe(true)
    expect(createFolderAtNode).not.toHaveBeenCalled()
  })

  it("confirms before delete and calls deleteNode for file nodes", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "file", path: "/tmp/skills/README.md" }, actions: { deleteNode } },
    })

    await wrapper.find("[data-test='delete']").trigger("click")
    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNode).toHaveBeenCalledWith({ type: "file", path: "/tmp/skills/README.md" })
  })

  it("confirms before delete and calls deleteNode for folder nodes", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "folder", path: "/tmp/skills/docs", name: "docs" }, actions: { deleteNode } },
    })

    await wrapper.find("[data-test='delete']").trigger("click")
    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNode).toHaveBeenCalledWith({ type: "folder", path: "/tmp/skills/docs", name: "docs" })
  })

  it("submits renameNode and copy-path actions from the context menu", async () => {
    const renameNode = vi.fn().mockResolvedValue()
    const copyPath = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: { renameNode, copyPath },
      },
    })

    await wrapper.find("[data-test='rename']").trigger("click")
    await wrapper.find("input[data-test='rename-input']").setValue("README-2.md")
    await wrapper.find("[data-test='rename-submit']").trigger("click")
    await wrapper.find("[data-test='copy-path']").trigger("click")

    expect(renameNode).toHaveBeenCalledWith({ type: "file", path: "/tmp/skills/README.md", name: "README.md" }, "README-2.md")
    expect(copyPath).toHaveBeenCalledWith("/tmp/skills/README.md")
  })

  it("submits copy-path for folder nodes from the context menu", async () => {
    const copyPath = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: { copyPath },
      },
    })

    await wrapper.find("[data-test='copy-path']").trigger("click")
    expect(copyPath).toHaveBeenCalledWith("/tmp/skills/docs")
  })

  it("submits renameNode for folder nodes from the context menu", async () => {
    const renameNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: { renameNode },
      },
    })

    await wrapper.find("[data-test='rename']").trigger("click")
    await wrapper.find("input[data-test='rename-input']").setValue("guides")
    await wrapper.find("[data-test='rename-submit']").trigger("click")
    expect(renameNode).toHaveBeenCalledWith({ type: "folder", path: "/tmp/skills/docs", name: "docs" }, "guides")
  })

  it("opens inline file-create inputs for a folder context action", async () => {
    const createFileAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "folder", path: "/tmp/skills" }, actions: { createFileAtNode } },
    })

    await wrapper.find("[data-test='new-file']").trigger("click")
    expect(wrapper.find("input[data-test='create-file-input']").exists()).toBe(true)
    expect(createFileAtNode).not.toHaveBeenCalled()
  })

  it("does not show new-file or new-folder actions for file nodes", () => {
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "file", path: "/tmp/skills/README.md" }, actions: {} },
    })

    expect(wrapper.find("[data-test='new-file']").exists()).toBe(false)
    expect(wrapper.find("[data-test='new-folder']").exists()).toBe(false)
  })

  it("submits an inline new-file name and passes it to createFileAtNode", async () => {
    const createFileAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "folder", path: "/tmp/skills" }, actions: { createFileAtNode } },
    })

    await wrapper.find("[data-test='new-file']").trigger("click")
    await wrapper.find("input[data-test='create-file-input']").setValue("draft.md")
    await wrapper.find("[data-test='create-file-submit']").trigger("click")
    expect(createFileAtNode).toHaveBeenCalledWith({ type: "folder", path: "/tmp/skills" }, "draft.md")
  })

  it("submits an inline new-folder name and passes it to createFolderAtNode", async () => {
    const createFolderAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: { visible: true, node: { type: "folder", path: "/tmp/skills" }, actions: { createFolderAtNode } },
    })

    await wrapper.find("[data-test='new-folder']").trigger("click")
    await wrapper.find("input[data-test='create-folder-input']").setValue("docs")
    await wrapper.find("[data-test='create-folder-submit']").trigger("click")
    expect(createFolderAtNode).toHaveBeenCalledWith({ type: "folder", path: "/tmp/skills" }, "docs")
  })

  it("emits close after copy-path completes", async () => {
    const copyPath = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md" },
        actions: { copyPath },
      },
    })
    await wrapper.find("[data-test='copy-path']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after rename completes", async () => {
    const renameNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: { renameNode },
      },
    })
    await wrapper.find("[data-test='rename']").trigger("click")
    await wrapper.find("input[data-test='rename-input']").setValue("NEW.md")
    await wrapper.find("[data-test='rename-submit']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after confirmed delete", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: { deleteNode },
      },
    })
    await wrapper.find("[data-test='delete']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("does not emit close when delete is cancelled", async () => {
    const deleteNode = vi.fn()
    window.confirm = vi.fn(() => false)
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: { deleteNode },
      },
    })
    await wrapper.find("[data-test='delete']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeFalsy()
  })

  it("emits close after create-file completes", async () => {
    const createFileAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills" },
        actions: { createFileAtNode },
      },
    })
    await wrapper.find("[data-test='new-file']").trigger("click")
    await wrapper.find("input[data-test='create-file-input']").setValue("draft.md")
    await wrapper.find("[data-test='create-file-submit']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after create-folder completes", async () => {
    const createFolderAtNode = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills" },
        actions: { createFolderAtNode },
      },
    })
    await wrapper.find("[data-test='new-folder']").trigger("click")
    await wrapper.find("input[data-test='create-folder-input']").setValue("docs")
    await wrapper.find("[data-test='create-folder-submit']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after rename even if action rejects", async () => {
    const renameNode = vi.fn().mockRejectedValue(new Error("fail"))
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: { renameNode },
      },
    })
    await wrapper.find("[data-test='rename']").trigger("click")
    await wrapper.find("input[data-test='rename-input']").setValue("NEW.md")
    await wrapper.find("[data-test='rename-submit']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after copy-path even if action rejects", async () => {
    const copyPath = vi.fn().mockRejectedValue(new Error("fail"))
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md" },
        actions: { copyPath },
      },
    })
    await wrapper.find("[data-test='copy-path']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after create-file even if action rejects", async () => {
    const createFileAtNode = vi.fn().mockRejectedValue(new Error("fail"))
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills" },
        actions: { createFileAtNode },
      },
    })
    await wrapper.find("[data-test='new-file']").trigger("click")
    await wrapper.find("input[data-test='create-file-input']").setValue("draft.md")
    await wrapper.find("[data-test='create-file-submit']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after create-folder even if action rejects", async () => {
    const createFolderAtNode = vi.fn().mockRejectedValue(new Error("fail"))
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills" },
        actions: { createFolderAtNode },
      },
    })
    await wrapper.find("[data-test='new-folder']").trigger("click")
    await wrapper.find("input[data-test='create-folder-input']").setValue("docs")
    await wrapper.find("[data-test='create-folder-submit']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after delete even if action rejects", async () => {
    const deleteNode = vi.fn().mockRejectedValue(new Error("fail"))
    window.confirm = vi.fn(() => true)
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: { deleteNode },
      },
    })
    await wrapper.find("[data-test='delete']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })
})

describe("set-as-root and save-to-my-skills actions", () => {
  it("shows Set as Root and Save to My Skills buttons for folder nodes", () => {
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: {},
      },
    })
    expect(wrapper.find("[data-test='set-as-root']").exists()).toBe(true)
    expect(wrapper.find("[data-test='save-to-my-skills']").exists()).toBe(true)
  })

  it("does not show Set as Root or Save to My Skills for file nodes", () => {
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "file", path: "/tmp/skills/README.md", name: "README.md" },
        actions: {},
      },
    })
    expect(wrapper.find("[data-test='set-as-root']").exists()).toBe(false)
    expect(wrapper.find("[data-test='save-to-my-skills']").exists()).toBe(false)
  })

  it("calls actions.setAsRoot with the node and emits close", async () => {
    const setAsRoot = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: { setAsRoot },
      },
    })
    await wrapper.find("[data-test='set-as-root']").trigger("click")
    await flushPromises()
    expect(setAsRoot).toHaveBeenCalledWith({ type: "folder", path: "/tmp/skills/docs", name: "docs" })
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("calls actions.saveToMySkills with the node and emits close", async () => {
    const saveToMySkills = vi.fn().mockResolvedValue()
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: { saveToMySkills },
      },
    })
    await wrapper.find("[data-test='save-to-my-skills']").trigger("click")
    await flushPromises()
    expect(saveToMySkills).toHaveBeenCalledWith({ type: "folder", path: "/tmp/skills/docs", name: "docs" })
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after saveToMySkills even if action rejects", async () => {
    const saveToMySkills = vi.fn().mockRejectedValue(new Error("fail"))
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: { saveToMySkills },
      },
    })
    await wrapper.find("[data-test='save-to-my-skills']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("emits close after setAsRoot even if action rejects", async () => {
    const setAsRoot = vi.fn().mockRejectedValue(new Error("fail"))
    const wrapper = mount(ContextMenu, {
      props: {
        visible: true,
        node: { type: "folder", path: "/tmp/skills/docs", name: "docs" },
        actions: { setAsRoot },
      },
    })
    await wrapper.find("[data-test='set-as-root']").trigger("click")
    await flushPromises()
    expect(wrapper.emitted("close")).toBeTruthy()
  })
})

describe("expand/collapse actions for folders", () => {
  it("shows Expand and Expand All when folder is collapsed", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        node: { name: "btc-model", path: "/skills/btc-model", type: "folder" },
        x: 100,
        y: 200,
        actions: {},
        isExpanded: false,
      },
    });
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    expect(labels).toContain("Expand");
    expect(labels).toContain("Expand All");
    expect(labels).not.toContain("Collapse");
  });

  it("shows Collapse and Expand All when folder is expanded", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        node: { name: "btc-model", path: "/skills/btc-model", type: "folder" },
        x: 100,
        y: 200,
        actions: {},
        isExpanded: true,
      },
    });
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    expect(labels).not.toContain("Expand");
    expect(labels).toContain("Expand All");
    expect(labels).toContain("Collapse");
  });

  it("shows neither Expand nor Collapse for file nodes", async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        node: { name: "SKILL.md", path: "/skills/btc-model/SKILL.md", type: "file" },
        x: 100,
        y: 200,
        actions: {},
        isExpanded: false,
      },
    });
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    expect(labels).not.toContain("Expand");
    expect(labels).not.toContain("Expand All");
    expect(labels).not.toContain("Collapse");
  });

  it("calls actions.toggleExpand and emits close when Expand clicked", async () => {
    const toggleExpand = vi.fn();
    const wrapper = mount(ContextMenu, {
      props: {
        node: { name: "btc-model", path: "/skills/btc-model", type: "folder" },
        x: 100,
        y: 200,
        actions: { toggleExpand },
        isExpanded: false,
      },
    });
    const expandBtn = wrapper.findAll("button").find((b) => b.text() === "Expand");
    await expandBtn.trigger("click");
    await flushPromises();
    expect(toggleExpand).toHaveBeenCalledWith("/skills/btc-model");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("calls actions.expandAll and emits close when Expand All clicked", async () => {
    const expandAll = vi.fn();
    const wrapper = mount(ContextMenu, {
      props: {
        node: { name: "btc-model", path: "/skills/btc-model", type: "folder" },
        x: 100,
        y: 200,
        actions: { expandAll },
        isExpanded: false,
      },
    });
    const expandAllBtn = wrapper.findAll("button").find((b) => b.text() === "Expand All");
    await expandAllBtn.trigger("click");
    await flushPromises();
    expect(expandAll).toHaveBeenCalledWith("/skills/btc-model");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("calls actions.toggleExpand and emits close when Collapse clicked", async () => {
    const toggleExpand = vi.fn();
    const wrapper = mount(ContextMenu, {
      props: {
        node: { name: "btc-model", path: "/skills/btc-model", type: "folder" },
        x: 100,
        y: 200,
        actions: { toggleExpand },
        isExpanded: true,
      },
    });
    const collapseBtn = wrapper.findAll("button").find((b) => b.text() === "Collapse");
    await collapseBtn.trigger("click");
    await flushPromises();
    expect(toggleExpand).toHaveBeenCalledWith("/skills/btc-model");
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
