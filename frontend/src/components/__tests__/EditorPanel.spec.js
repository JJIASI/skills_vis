import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount } from "@vue/test-utils"
import EditorPanel from "../EditorPanel.vue"

vi.mock("md-editor-v3", () => ({
  MdEditor: {
    name: "MdEditor",
    props: ["modelValue", "editorId"],
    emits: ["update:modelValue"],
    template: `<div data-test="md-editor"><textarea data-test="md-editor-input" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></div>`,
  },
  MdPreview: {
    name: "MdPreview",
    props: ["modelValue", "id"],
    template: `<div data-test="md-preview" :data-id="id" :data-content="modelValue"></div>`,
  },
  MdCatalog: {
    name: "MdCatalog",
    props: ["editorId"],
    template: `<div data-test="md-catalog" :data-editor-id="editorId"></div>`,
  },
  config: vi.fn(),
}))

describe("EditorPanel", () => {
  it("shows markdown preview for .md files", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/SKILL.md", content: "# Hello", kind: "text" },
        selectedNode: { name: "SKILL.md", path: "/tmp/skills/SKILL.md", type: "file", is_skill: true },
      },
    })

    expect(wrapper.find("[data-test='md-preview']").exists()).toBe(true)
    expect(wrapper.find("[data-test='preview-tab']").exists()).toBe(false)
    expect(wrapper.find("[data-test='edit-tab']").exists()).toBe(false)
  })

  it("shows markdown preview for ordinary .md files", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# Notes", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })

    expect(wrapper.find("[data-test='md-preview']").exists()).toBe(true)
    expect(wrapper.find("[data-test='editor-input']").exists()).toBe(false)
  })

  it("does not show markdown preview for non-markdown text files", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/notes.txt", content: "hello", kind: "text" },
        selectedNode: { name: "notes.txt", path: "/tmp/skills/notes.txt", type: "file", is_skill: false },
      },
    })

    expect(wrapper.find("[data-test='md-preview']").exists()).toBe(false)
    expect(wrapper.find("[data-test='editor-input']").exists()).toBe(true)
  })

  it("editor is bound to editorContent for .md files in edit mode", async () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# Notes", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })

    // Enter edit mode
    await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
    expect(wrapper.find("[data-test='md-editor-input']").element.value).toBe("# Notes")
  })

  it("shows the selected file name and full path in the editor header", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# Notes", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })

    expect(wrapper.find("[data-test='editor-header-name']").text()).toBe("README.md")
    expect(wrapper.find("[data-test='editor-header-path']").text()).toBe("/tmp/skills/README.md")
  })

  it("shows a cannot preview message for binary files while still allowing delete but not save", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/image.png", content: null, kind: "binary" },
        selectedNode: { name: "image.png", path: "/tmp/skills/image.png", type: "file", is_skill: false },
      },
    })

    expect(wrapper.text()).toContain("Cannot preview")
    expect(wrapper.find("[data-test='save']").exists()).toBe(false)
    expect(wrapper.find("[data-test='delete-file']").exists()).toBe(true)
  })

  it("restores the original content when cancel is clicked", async () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })

    await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
    await wrapper.vm.setEditorContentForTest("# changed")
    await wrapper.find("[data-test='cancel']").trigger("click")

    expect(wrapper.find("[data-test='editor-mode']").attributes("data-content")).toBe("# start")
  })

  it("resets header and editor state when the selected node changes", async () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })

    await wrapper.vm.setEditorContentForTest("# changed")
    await wrapper.setProps({
      currentFile: null,
      selectedNode: { name: "docs", path: "/tmp/skills/docs", type: "folder" },
    })

    expect(wrapper.find("[data-test='editor-header-name']").text()).toBe("docs")
    expect(wrapper.find("[data-test='editor-header-path']").text()).toBe("/tmp/skills/docs")
    expect(wrapper.find("[data-test='delete-folder']").exists()).toBe(true)
    expect(wrapper.find("[data-test='editor-mode']").exists()).toBe(false)
  })

  it("shows save, cancel, and delete actions in the editor header for an open file", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/notes.txt", content: "# start", kind: "text" },
        selectedNode: { name: "notes.txt", path: "/tmp/skills/notes.txt", type: "file", is_skill: false },
      },
    })

    expect(wrapper.find("[data-test='save']").exists()).toBe(true)
    expect(wrapper.find("[data-test='cancel']").exists()).toBe(true)
    expect(wrapper.find("[data-test='delete-file']").exists()).toBe(true)
    expect(wrapper.find("[data-test='rename-file']").exists()).toBe(false)
  })

  it("submits delete action from the editor header for a file", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        actions: { deleteNode },
      },
    })

    await wrapper.find("[data-test='delete-file']").trigger("click")

    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNode).toHaveBeenCalledWith(
      { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
    )
  })

  it("shows delete action and no save in the editor header when a folder is selected", async () => {
    const deleteNode = vi.fn().mockResolvedValue()
    window.confirm = vi.fn(() => true)
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: null,
        selectedNode: { name: "docs", path: "/tmp/skills/docs", type: "folder" },
        actions: { deleteNode },
      },
    })

    expect(wrapper.find("[data-test='delete-folder']").exists()).toBe(true)
    expect(wrapper.find("[data-test='save']").exists()).toBe(false)
    expect(wrapper.find("[data-test='rename-folder']").exists()).toBe(false)
    await wrapper.find("[data-test='delete-folder']").trigger("click")
    expect(window.confirm).toHaveBeenCalled()
    expect(deleteNode).toHaveBeenCalledWith({ name: "docs", path: "/tmp/skills/docs", type: "folder" })
  })

  it("shows the selected folder name and full path in the editor header", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: null,
        selectedNode: { name: "docs", path: "/tmp/skills/docs", type: "folder" },
      },
    })

    expect(wrapper.find("[data-test='editor-header-name']").text()).toBe("docs")
    expect(wrapper.find("[data-test='editor-header-path']").text()).toBe("/tmp/skills/docs")
  })

  it("uses syntax highlighting for code files", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/script.py", content: "print('hi')", kind: "text" },
        selectedNode: { name: "script.py", path: "/tmp/skills/script.py", type: "file", is_skill: false },
      },
    })

    expect(wrapper.find("[data-test='editor-mode']").attributes("data-language")).toBe("python")
  })

  it("falls back to plain-text editing for unknown text files", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/notes.txt", content: "hello", kind: "text" },
        selectedNode: { name: "notes.txt", path: "/tmp/skills/notes.txt", type: "file", is_skill: false },
      },
    })

    expect(wrapper.find("[data-test='editor-mode']").attributes("data-language")).toBe("text")
  })

  it("uses markdown language mode for markdown files", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# Notes", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })
    expect(wrapper.find("[data-test='editor-mode']").attributes("data-language")).toBe("markdown")
  })

  it("save button has a tooltip title", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/notes.txt", content: "# start", kind: "text" },
        selectedNode: { name: "notes.txt", path: "/tmp/skills/notes.txt", type: "file", is_skill: false },
      },
    })
    expect(wrapper.find("[data-test='save']").attributes("title")).toBe("Save")
  })

  it("cancel button has a tooltip title", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/notes.txt", content: "# start", kind: "text" },
        selectedNode: { name: "notes.txt", path: "/tmp/skills/notes.txt", type: "file", is_skill: false },
      },
    })
    expect(wrapper.find("[data-test='cancel']").attributes("title")).toBe("Cancel")
  })

  it("delete-file button has a tooltip title", () => {
    const wrapper = mount(EditorPanel, {
      props: {
        currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
        selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
      },
    })
    expect(wrapper.find("[data-test='delete-file']").attributes("title")).toBe("Delete")
  })

  describe("inline rename", () => {
    it("clicking the header name enters edit mode with an input pre-filled with the node name", async () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })

      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(false)
      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      const input = wrapper.find("[data-test='editor-header-name-input']")
      expect(input.exists()).toBe(true)
      expect(input.element.value).toBe("README.md")
    })

    it("pressing Enter in the name input calls renameNode with the new name", async () => {
      const renameNode = vi.fn().mockResolvedValue()
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("RENAMED.md")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.enter")

      expect(renameNode).toHaveBeenCalledWith(
        { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        "RENAMED.md",
      )
      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(false)
    })

    it("pressing Escape in the name input cancels rename and does not call renameNode", async () => {
      const renameNode = vi.fn()
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("RENAMED.md")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.escape")

      expect(renameNode).not.toHaveBeenCalled()
      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(false)
    })

    it("does not call renameNode if the name is unchanged", async () => {
      const renameNode = vi.fn()
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.enter")

      expect(renameNode).not.toHaveBeenCalled()
    })

    it("does not call renameNode if the new name is empty or whitespace", async () => {
      const renameNode = vi.fn()
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("   ")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.enter")

      expect(renameNode).not.toHaveBeenCalled()
      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(false)
    })

    it("shows an error message if renameNode rejects, and keeps the input open", async () => {
      const renameNode = vi.fn().mockRejectedValue(new Error("conflict"))
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("CONFLICT.md")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.enter")
      await wrapper.vm.$nextTick()

      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(true)
      expect(wrapper.find("[data-test='editor-header-name-error']").text()).toContain("Rename failed")
    })

    it("cancels an active name edit and clears error when the selected node changes", async () => {
      const renameNode = vi.fn().mockRejectedValue(new Error("conflict"))
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("CONFLICT.md")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.enter")
      await wrapper.vm.$nextTick()

      await wrapper.setProps({
        currentFile: null,
        selectedNode: { name: "docs", path: "/tmp/skills/docs", type: "folder" },
      })

      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(false)
      expect(wrapper.find("[data-test='editor-header-name-error']").exists()).toBe(false)
    })

    it("blurring the name input with a changed name calls renameNode", async () => {
      const renameNode = vi.fn().mockResolvedValue()
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# start", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("BLURRED.md")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("blur")
      await wrapper.vm.$nextTick()

      expect(renameNode).toHaveBeenCalledWith(
        { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        "BLURRED.md",
      )
      expect(wrapper.find("[data-test='editor-header-name-input']").exists()).toBe(false)
    })

    it("allows renaming a folder by clicking its header name", async () => {
      const renameNode = vi.fn().mockResolvedValue()
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: null,
          selectedNode: { name: "docs", path: "/tmp/skills/docs", type: "folder" },
          actions: { renameNode },
        },
      })

      await wrapper.find("[data-test='editor-header-name']").trigger("click")
      await wrapper.find("[data-test='editor-header-name-input']").setValue("guides")
      await wrapper.find("[data-test='editor-header-name-input']").trigger("keyup.enter")

      expect(renameNode).toHaveBeenCalledWith(
        { name: "docs", path: "/tmp/skills/docs", type: "folder" },
        "guides",
      )
    })
  })

  describe("skill header", () => {
    it("shows skill header fields in header-info for a markdown file with front matter", () => {
      const content = "---\nname: my-skill\ndescription: Does something useful.\nversion: 1.0.0\n---\n# Body"
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/SKILL.md", content, kind: "text" },
          selectedNode: { name: "SKILL.md", path: "/tmp/skills/SKILL.md", type: "file", is_skill: true },
        },
      })
      expect(wrapper.find("[data-test='skill-header']").exists()).toBe(true)
      expect(wrapper.find("[data-test='skill-header-name']").text()).toBe("my-skill")
      expect(wrapper.find("[data-test='skill-header-description']").text()).toBe("Does something useful.")
      expect(wrapper.find("[data-test='skill-header-version']").text()).toContain("1.0.0")
    })

    it("shows tags as individual chips", () => {
      const content = "---\nname: my-skill\nmetadata:\n  hermes:\n    tags: [AI, Tool, Useful]\n---"
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/SKILL.md", content, kind: "text" },
          selectedNode: { name: "SKILL.md", path: "/tmp/skills/SKILL.md", type: "file", is_skill: true },
        },
      })
      const chips = wrapper.findAll("[data-test='skill-header-tag']")
      expect(chips).toHaveLength(3)
      expect(chips[0].text()).toBe("AI")
      expect(chips[1].text()).toBe("Tool")
      expect(chips[2].text()).toBe("Useful")
    })

    it("does not show skill header for non-markdown files", () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/notes.txt", content: "hello", kind: "text" },
          selectedNode: { name: "notes.txt", path: "/tmp/skills/notes.txt", type: "file", is_skill: false },
        },
      })
      expect(wrapper.find("[data-test='skill-header']").exists()).toBe(false)
    })

    it("does not show skill header for markdown files without front matter", () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Just markdown", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      expect(wrapper.find("[data-test='skill-header']").exists()).toBe(false)
    })

    it("does not show version element when version is absent", () => {
      const content = "---\nname: minimal\ndescription: Minimal skill.\n---"
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/SKILL.md", content, kind: "text" },
          selectedNode: { name: "SKILL.md", path: "/tmp/skills/SKILL.md", type: "file", is_skill: true },
        },
      })
      expect(wrapper.find("[data-test='skill-header']").exists()).toBe(true)
      expect(wrapper.find("[data-test='skill-header-version']").exists()).toBe(false)
    })
  })

  describe("markdown preview/edit mode", () => {
    it("shows MdCatalog sidebar and MdPreview by default for markdown files", () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Hello", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      expect(wrapper.find("[data-test='md-catalog']").exists()).toBe(true)
      expect(wrapper.find("[data-test='md-preview']").exists()).toBe(true)
      expect(wrapper.find("[data-test='md-editor']").exists()).toBe(false)
    })

    it("shows Edit button in preview mode, hides Save and Cancel", () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Hello", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      expect(wrapper.find("[data-test='edit-mode-toggle']").exists()).toBe(true)
      expect(wrapper.find("[data-test='save']").exists()).toBe(false)
      expect(wrapper.find("[data-test='cancel']").exists()).toBe(false)
    })

    it("clicking Edit switches to full editor — hides catalog/preview, shows MdEditor and Save/Cancel, removes Edit button", async () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Hello", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
      expect(wrapper.find("[data-test='md-catalog']").exists()).toBe(false)
      expect(wrapper.find("[data-test='md-preview']").exists()).toBe(false)
      expect(wrapper.find("[data-test='md-editor']").exists()).toBe(true)
      expect(wrapper.find("[data-test='save']").exists()).toBe(true)
      expect(wrapper.find("[data-test='cancel']").exists()).toBe(true)
      expect(wrapper.find("[data-test='edit-mode-toggle']").exists()).toBe(false)
    })

    it("Cancel in edit mode reverts content and returns to preview mode", async () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Hello", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
      await wrapper.vm.setEditorContentForTest("# Changed")
      await wrapper.find("[data-test='cancel']").trigger("click")
      expect(wrapper.find("[data-test='md-preview']").exists()).toBe(true)
      expect(wrapper.find("[data-test='md-editor']").exists()).toBe(false)
      expect(wrapper.find("[data-test='md-editor-input']").exists()).toBe(false)
    })

    it("isEditMode resets to false (back to preview) when selectedNode changes", async () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Hello", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
      expect(wrapper.find("[data-test='edit-mode-toggle']").exists()).toBe(false) // in edit mode

      await wrapper.setProps({
        selectedNode: { name: "other.md", path: "/tmp/skills/other.md", type: "file", is_skill: false },
      })
      expect(wrapper.find("[data-test='edit-mode-toggle']").exists()).toBe(true) // back to preview
    })

    it("isEditMode resets to false (back to preview) when currentFile changes", async () => {
      const wrapper = mount(EditorPanel, {
        props: {
          currentFile: { path: "/tmp/skills/README.md", content: "# Hello", kind: "text" },
          selectedNode: { name: "README.md", path: "/tmp/skills/README.md", type: "file", is_skill: false },
        },
      })
      await wrapper.find("[data-test='edit-mode-toggle']").trigger("click")
      expect(wrapper.find("[data-test='edit-mode-toggle']").exists()).toBe(false) // in edit mode

      await wrapper.setProps({
        currentFile: { path: "/tmp/skills/GUIDE.md", content: "# Guide", kind: "text" },
      })
      expect(wrapper.find("[data-test='edit-mode-toggle']").exists()).toBe(true) // back to preview
    })
  })
})
