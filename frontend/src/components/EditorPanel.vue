<template>
  <div v-if="selectedNode" class="editor-file-view">
    <div class="editor-header" ref="headerRef" data-test="editor-header"
      :style="headerHeight !== null ? { height: headerHeight + 'px', overflow: 'auto' } : {}"
    >
      <div class="header-info">
        <span
          v-if="!isEditingName"
          class="header-name"
          data-test="editor-header-name"
          tabindex="0"
          role="button"
          @click="startNameEdit"
          @keydown.enter="startNameEdit"
        >{{ selectedNode.name }}</span>
        <div v-else class="header-name-edit">
          <input
            ref="nameInputRef"
            v-model="editingName"
            class="header-name-input"
            data-test="editor-header-name-input"
            type="text"
            @keyup.enter="commitNameEdit"
            @keyup.escape="cancelNameEdit"
            @blur="commitNameEdit"
          />
          <div
            v-if="renameError"
            class="rename-error"
            data-test="editor-header-name-error"
          >{{ renameError }}</div>
        </div>
        <div class="header-path" data-test="editor-header-path">{{ collapseHome(selectedNode.path) }}</div>
        <div v-if="skillHeader" class="skill-header" data-test="skill-header">
          <div class="skill-header-name" data-test="skill-header-name">{{ skillHeader.name }}</div>
          <div class="skill-header-description" data-test="skill-header-description">{{ skillHeader.description }}</div>
          <div v-if="skillHeader.version || skillHeader.author || skillHeader.license" class="skill-header-meta">
            <span v-if="skillHeader.version" class="skill-header-version" data-test="skill-header-version">v{{ skillHeader.version }}</span>
            <span v-if="skillHeader.author" class="skill-header-author" data-test="skill-header-author">{{ skillHeader.author }}</span>
            <span v-if="skillHeader.license" class="skill-header-license" data-test="skill-header-license">{{ skillHeader.license }}</span>
          </div>
          <div v-if="skillHeader.tags && skillHeader.tags.length" class="skill-header-tags">
            <span
              v-for="tag in skillHeader.tags"
              :key="tag"
              class="skill-header-tag"
              data-test="skill-header-tag"
            >{{ tag }}</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <!-- Edit button: markdown files in preview mode only -->
        <template v-if="isMarkdown && !isEditMode">
          <button
            type="button"
            data-test="edit-mode-toggle"
            title="Edit"
            class="icon-btn"
            @click="toggleEditMode"
          >
            <!-- Lucide pencil icon -->
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </template>

        <!-- Save/Cancel: non-markdown text files always; markdown files only in edit mode -->
        <template v-if="currentFile && currentFile.kind === 'text' && (!isMarkdown || isEditMode)">
          <button type="button" data-test="save" title="Save" class="icon-btn" @click="handleSave">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
          <button type="button" data-test="cancel" title="Cancel" class="icon-btn" @click="handleCancel">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </template>
        <template v-if="selectedNode.type === 'file'">
          <button type="button" data-test="delete-file" title="Delete" class="icon-btn icon-btn--danger" @click="handleDelete">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </template>
        <template v-if="selectedNode.type === 'folder'">
          <button type="button" data-test="delete-folder" title="Delete" class="icon-btn icon-btn--danger" @click="handleDelete">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </template>
      </div>
    </div>
    <div class="header-resize-handle" data-test="header-resize-handle" @mousedown="startHeaderResize">
      <span class="grip-indicator-h">···</span>
    </div>

    <div class="editor-content">
      <template v-if="!currentFile">
        <div>Folder selected</div>
      </template>
      <template v-else-if="currentFile.kind === 'binary'">
        <div>Cannot preview binary file</div>
      </template>
      <template v-else-if="isMarkdown">
        <div class="markdown-view-container">
          <!-- Preview mode (default) -->
          <template v-if="!isEditMode">
            <MdPreview
              :id="editorId"
              :modelValue="editorContent"
              class="md-preview"
            />
            <MdCatalog
              :editorId="editorId"
              scrollElement=".md-preview"
              class="md-catalog-sidebar"
            />
          </template>
          <!-- Edit mode -->
          <template v-else>
            <MdEditor
              :editorId="editorId"
              v-model="editorContent"
            />
          </template>
        </div>
        <div
          data-test="editor-mode"
          :data-language="editorLanguage"
          :data-content="editorContent"
          style="display: none"
        ></div>
      </template>
      <template v-else>
        <textarea
          v-model="editorContent"
          data-test="editor-input"
          class="editor-textarea"
        ></textarea>
        <div
          data-test="editor-mode"
          :data-language="editorLanguage"
          :data-content="editorContent"
          style="display: none"
        ></div>
      </template>
    </div>
  </div>
  <!-- Empty / no-file-selected state -->
  <div v-else class="editor-file-view">
    <div class="reader-empty">
      <div class="reader-hero">
        <div class="reader-glyph">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3z"/>
          </svg>
        </div>
        <h2>Inspect a skill</h2>
        <p>Click any node in the graph to preview its <code class="mono">SKILL.md</code> here. Right-click for rename, delete and copy path.</p>
      </div>

      <div class="hint-list">
        <div class="hint">
          <span class="k mono">click</span>
          <span class="t"><b>Open</b> a file or expand a folder.</span>
        </div>
        <div class="hint">
          <span class="k mono">{{ modKey }} K</span>
          <span class="t"><b>Search</b> across every skill in the workspace.</span>
        </div>
        <div class="hint">
          <span class="k mono">{{ modKey }}⇧R</span>
          <span class="t"><b>Record</b> a session to highlight skills as an agent invokes them.</span>
        </div>
        <div class="hint">
          <span class="k mono">right‑click</span>
          <span class="t"><b>Manage</b> — rename, delete, save to a workspace, copy path.</span>
        </div>
      </div>

      <div v-if="recentFiles && recentFiles.length">
        <div class="reader-recent-hd">Recently opened</div>
        <div
          v-for="(f, i) in recentFiles"
          :key="i"
          class="rec-row"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent); flex-shrink: 0;" aria-hidden="true">
            <path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3z"/>
          </svg>
          <div style="flex: 1; min-width: 0;">
            <div class="nm">
              {{ f.parent }}<span style="color: var(--muted); margin-left: 6px;" class="mono">/ {{ f.name }}</span>
            </div>
            <div class="pt" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ f.path }}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" style="color: var(--subtle); flex-shrink: 0;" aria-hidden="true">
            <path d="m9 6 6 6-6 6"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from "vue"
import { MdEditor, MdPreview, MdCatalog, config } from "md-editor-v3"
import "md-editor-v3/lib/style.css"
import { classifyFile } from "../utils/fileKind"
import { parseFrontMatter } from "../utils/parseFrontMatter"
import { collapseHome } from "../utils/path.js"

// Strip YAML front matter from the MdEditor preview (right-side only)
config({
  markdownItConfig(mdit) {
    const orig = mdit.render.bind(mdit)
    mdit.render = (src, env) => orig(src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""), env)
  },
})

export default {
  components: { MdEditor, MdPreview, MdCatalog },
  props: {
    currentFile: Object,
    selectedNode: Object,
    recentFiles: { type: Array, default: () => [] },
    actions: {
      type: Object,
      default: () => ({}),
    },
  },
  setup(props) {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const modKey = isMac ? "⌘" : "Ctrl";

    const editorContent = ref(props.currentFile?.content || "")
    const isEditingName = ref(false)
    const editingName = ref("")
    const renameError = ref(null)
    const nameInputRef = ref(null)
    const isCommittingName = ref(false)
    const headerRef = ref(null)
    const headerHeight = ref(null)
    const isEditMode = ref(false)
    const editorId = "skills-vis-md-editor"

    function startHeaderResize(e) {
      const startY = e.clientY
      const startH = headerRef.value ? headerRef.value.offsetHeight : 60
      const onMove = (ev) => {
        headerHeight.value = Math.max(40, startH + (ev.clientY - startY))
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      e.preventDefault()
    }

    const isMarkdown = computed(() => {
      if (!props.currentFile) return false
      return props.currentFile.path?.endsWith(".md") && props.currentFile.kind === "text"
    })

    const editorLanguage = computed(() => {
      if (!props.currentFile || props.currentFile.kind !== "text") return "text"
      const classification = classifyFile(props.currentFile.path)
      if (classification === "markdown") return "markdown"
      if (classification === "code") {
        const path = props.currentFile.path
        if (path.endsWith(".py")) return "python"
        if (path.endsWith(".js") || path.endsWith(".ts") || path.endsWith(".json")) return "javascript"
        return "javascript"
      }
      return "text"
    })

    const isModified = computed(() => {
      return editorContent.value !== (props.currentFile?.content || "")
    })

    const skillHeader = computed(() => {
      if (!isMarkdown.value) return null
      return parseFrontMatter(editorContent.value)
    })

    const handleSave = async () => {
      if (props.actions.saveSelectedFile) {
        await props.actions.saveSelectedFile(editorContent.value)
      }
    }

    const handleCancel = () => {
      editorContent.value = props.currentFile?.content || ""
      isEditMode.value = false
      isEditingName.value = false
    }

    const toggleEditMode = () => {
      isEditMode.value = true
    }

    const handleDelete = async () => {
      if (window.confirm(`Delete ${props.selectedNode.name}?`)) {
        if (props.actions.deleteNode) {
          await props.actions.deleteNode(props.selectedNode)
        }
      }
    }

    const startNameEdit = () => {
      editingName.value = props.selectedNode.name
      isEditingName.value = true
      renameError.value = null
      nextTick(() => nameInputRef.value?.focus())
    }

    const cancelNameEdit = () => {
      isEditingName.value = false
      editingName.value = ""
      renameError.value = null
      isCommittingName.value = false
    }

    const commitNameEdit = async () => {
      if (!isEditingName.value || isCommittingName.value) return
      const newName = editingName.value.trim()
      if (!newName || newName === props.selectedNode.name) {
        cancelNameEdit()
        return
      }
      isCommittingName.value = true
      try {
        await props.actions.renameNode(props.selectedNode, newName)
        isEditingName.value = false
        renameError.value = null
      } catch {
        renameError.value = "Rename failed — invalid name or conflict"
      } finally {
        isCommittingName.value = false
      }
    }

    const setEditorContentForTest = async (content) => {
      editorContent.value = content
    }

    watch(() => props.currentFile, (newFile) => {
      if (newFile) {
        editorContent.value = newFile.content || ""
      }
      isEditMode.value = false
    }, { deep: true, immediate: true })

    watch(() => props.selectedNode, () => {
      isEditingName.value = false
      editingName.value = ""
      renameError.value = null
      isCommittingName.value = false
      isEditMode.value = false
    })

    return {
      editorContent,
      isEditingName,
      editingName,
      renameError,
      nameInputRef,
      isCommittingName,
      isMarkdown,
      editorLanguage,
      isModified,
      skillHeader,
      headerRef,
      headerHeight,
      startHeaderResize,
      handleSave,
      handleCancel,
      handleDelete,
      startNameEdit,
      cancelNameEdit,
      commitNameEdit,
      setEditorContentForTest,
      isEditMode,
      editorId,
      toggleEditMode,
      modKey,
      collapseHome,
    }
  },
}
</script>

<style scoped>
.editor-file-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  overflow: hidden;
  flex: none;
  min-height: 40px;
}

.header-resize-handle {
  height: 5px;
  flex-shrink: 0;
  background: #e0e0e0;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transition: background 0.15s;
  border-top: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
}

.header-resize-handle:hover {
  background: #c0c0c0;
}

.grip-indicator-h {
  font-size: 10px;
  color: #999;
  line-height: 1;
  letter-spacing: -2px;
  transform: rotate(90deg);
}

.header-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.header-name {
  font-weight: bold;
  cursor: pointer;
}

.header-name:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
}

.header-name-edit {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header-name-input {
  font-weight: bold;
  font-size: inherit;
  font-family: inherit;
  border: none;
  border-bottom: 2px solid #4a90e2;
  background: transparent;
  outline: none;
  padding: 0;
  width: 100%;
}

.rename-error {
  font-size: 0.8em;
  color: #c00;
  margin-top: 2px;
}

.header-path {
  font-size: 0.9em;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Override md-editor-v3's hardcoded height: 500px so it fills available space */
.editor-content :deep(.md-editor) {
  flex: 1;
  min-height: 0;
  height: auto;
}

.markdown-view-container {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.md-preview {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 16px;
}

.md-catalog-sidebar {
  width: 160px;
  flex-shrink: 0;
  overflow-y: auto;
  border-left: 1px solid #f0f0f0;
  padding: 8px;
  font-size: 12px;
}

/* md-editor-v3 sets z-index:10000 on sticky code block headers, which bleeds
   above the SkillsDrawer (z-index:101). Clamp it to a safe value. */
.md-preview :deep(.md-editor-code-head) {
  z-index: 2;
}


.editor-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  font-family: monospace;
  padding: 8px;
  border: none;
  resize: none;
}

.icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #333;
}

.icon-btn:hover {
  background: #f0f0f0;
}

.icon-btn--danger {
  border-color: #e88;
  color: #c00;
}

.icon-btn--danger:hover {
  background: #fff0f0;
}

.skill-header {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.skill-header-name {
  font-size: 0.85em;
  font-weight: 600;
  color: #2563eb;
}

.skill-header-description {
  font-size: 0.78em;
  color: #555;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-header-meta {
  display: flex;
  gap: 8px;
  font-size: 0.75em;
  color: #777;
}

.skill-header-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.skill-header-tag {
  font-size: 0.72em;
  padding: 1px 6px;
  border-radius: 10px;
  background: #e8f0fe;
  color: #1a56db;
  border: 1px solid #c7d7f9;
  white-space: nowrap;
}
</style>


