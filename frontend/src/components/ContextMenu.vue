<template>
  <div v-show="visible && node" class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
    <template v-if="!showCreateFileInput && !showCreateFolderInput && !showRenameInput && node">
      <!-- Expand/Collapse buttons: folder nodes only -->
      <template v-if="node.type === 'folder'">
        <button v-if="!isExpanded" @click="handleExpand">Expand</button>
        <button @click="handleExpandAll">Expand All</button>
        <button v-if="isExpanded" @click="handleCollapse">Collapse</button>
      </template>
      <button v-if="node.type === 'folder'" data-test="set-as-root" @click="handleSetAsRoot">Set as Root</button>
      <button v-if="node.type === 'file'" data-test="rename" @click="showRenameInput = true">
        Rename
      </button>
      <button v-if="node.type === 'folder'" data-test="rename" @click="showRenameInput = true">
        Rename
      </button>
      <button data-test="copy-path" @click="handleCopyPath">Copy Path</button>
      <button v-if="node.type === 'folder'" data-test="new-file" @click="createFileValue = 'SKILL.md'; showCreateFileInput = true">
        New File
      </button>
      <button v-if="node.type === 'folder'" data-test="new-folder" @click="createFolderValue = 'skills'; showCreateFolderInput = true">
        New Folder
      </button>
      <button v-if="node.type === 'folder'" data-test="save-to-my-skills" @click="handleSaveToMySkills">Save to My Skills</button>
      <button data-test="delete" @click="handleDelete">Delete</button>
    </template>

    <template v-if="showRenameInput && node">
      <div class="inline-form">
        <span class="inline-form-label">Rename</span>
        <input
          v-model="renameValue"
          class="inline-form-input"
          data-test="rename-input"
          @keyup.enter="handleRename"
          @keyup.escape="showRenameInput = false"
        />
        <div class="inline-form-actions">
          <button class="inline-form-submit" data-test="rename-submit" @click="handleRename">Rename</button>
          <button class="inline-form-cancel" @click="showRenameInput = false">Cancel</button>
        </div>
      </div>
    </template>

    <template v-if="showCreateFileInput && node">
      <div class="inline-form">
        <span class="inline-form-label">New File</span>
        <input
          v-model="createFileValue"
          class="inline-form-input"
          data-test="create-file-input"
          placeholder="file name"
          @keyup.enter="handleCreateFile"
          @keyup.escape="showCreateFileInput = false"
        />
        <div class="inline-form-actions">
          <button class="inline-form-submit" data-test="create-file-submit" @click="handleCreateFile">Create</button>
          <button class="inline-form-cancel" @click="showCreateFileInput = false">Cancel</button>
        </div>
      </div>
    </template>

    <template v-if="showCreateFolderInput && node">
      <div class="inline-form">
        <span class="inline-form-label">New Folder</span>
        <input
          v-model="createFolderValue"
          class="inline-form-input"
          data-test="create-folder-input"
          placeholder="folder name"
          @keyup.enter="handleCreateFolder"
          @keyup.escape="showCreateFolderInput = false"
        />
        <div class="inline-form-actions">
          <button class="inline-form-submit" data-test="create-folder-submit" @click="handleCreateFolder">Create</button>
          <button class="inline-form-cancel" @click="showCreateFolderInput = false">Cancel</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, watch } from "vue"

export default {
  props: {
    visible: Boolean,
    node: Object,
    x: Number,
    y: Number,
    actions: {
      type: Object,
      default: () => ({}),
    },
    isExpanded: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close"],
  setup(props, { emit }) {
    const showRenameInput = ref(false)
    const showCreateFileInput = ref(false)
    const showCreateFolderInput = ref(false)
    const renameValue = ref("")
    const createFileValue = ref("")
    const createFolderValue = ref("")

    // Reset inline input state whenever the menu closes so a re-open always shows normal tools
    watch(() => props.visible, (visible) => {
      if (!visible) {
        showRenameInput.value = false
        showCreateFileInput.value = false
        showCreateFolderInput.value = false
        renameValue.value = ""
        createFileValue.value = ""
        createFolderValue.value = ""
      }
    })

    const handleRename = async () => {
      try {
        if (props.actions.renameNode && renameValue.value) {
          await props.actions.renameNode(props.node, renameValue.value)
        }
      } catch {
        // action failed; menu still closes via finally
      } finally {
        showRenameInput.value = false
        renameValue.value = ""
        emit("close")
      }
    }

    const handleCopyPath = async () => {
      try {
        if (props.actions.copyPath) {
          await props.actions.copyPath(props.node.path)
        }
      } catch {
        // action failed; menu still closes via finally
      } finally {
        emit("close")
      }
    }

    const handleCreateFile = async () => {
      try {
        if (props.actions.createFileAtNode && createFileValue.value) {
          await props.actions.createFileAtNode(props.node, createFileValue.value)
        }
      } catch {
        // action failed; menu still closes via finally
      } finally {
        showCreateFileInput.value = false
        createFileValue.value = ""
        emit("close")
      }
    }

    const handleCreateFolder = async () => {
      try {
        if (props.actions.createFolderAtNode && createFolderValue.value) {
          await props.actions.createFolderAtNode(props.node, createFolderValue.value)
        }
      } catch {
        // action failed; menu still closes via finally
      } finally {
        showCreateFolderInput.value = false
        createFolderValue.value = ""
        emit("close")
      }
    }

    const handleExpand = async () => {
      try {
        await props.actions.toggleExpand?.(props.node.path);
      } catch {
        // action failed; menu still closes via finally
      } finally {
        emit("close");
      }
    }

    const handleExpandAll = async () => {
      try {
        await props.actions.expandAll?.(props.node.path);
      } catch {
        // action failed; menu still closes via finally
      } finally {
        emit("close");
      }
    }

    const handleCollapse = async () => {
      try {
        await props.actions.toggleExpand?.(props.node.path);
      } catch {
        // action failed; menu still closes via finally
      } finally {
        emit("close");
      }
    }

    const handleSetAsRoot = async () => {
      try {
        await props.actions.setAsRoot?.(props.node);
      } catch {
        // action failed; menu still closes via finally
      } finally {
        emit("close");
      }
    }

    const handleSaveToMySkills = async () => {
      try {
        await props.actions.saveToMySkills?.(props.node);
      } catch {
        // action failed; menu still closes via finally
      } finally {
        emit("close");
      }
    }

    const handleDelete = async () => {
      if (window.confirm(`Delete ${props.node.name || props.node.path}?`)) {
        try {
          await props.actions.deleteNode(props.node)
        } catch {
          // action failed; menu still closes via finally
        } finally {
          emit("close")
        }
      }
    }

    return {
      showRenameInput,
      showCreateFileInput,
      showCreateFolderInput,
      renameValue,
      createFileValue,
      createFolderValue,
      handleRename,
      handleCopyPath,
      handleCreateFile,
      handleCreateFolder,
      handleDelete,
      handleExpand,
      handleExpandAll,
      handleCollapse,
      handleSetAsRoot,
      handleSaveToMySkills,
    }
  },
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--raised);
  border: 1px solid var(--border-2);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px 0;
  min-width: 120px;
}

button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

button:hover {
  background-color: var(--sub);
}

/* Inline create/rename form */
.inline-form {
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
}

.inline-form-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inline-form-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border-2);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text);
}

.inline-form-input:focus {
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.15);
}

.inline-form-actions {
  display: flex;
  gap: 6px;
}

.inline-form-submit {
  flex: 1;
  padding: 5px 0;
  background: #4a90e2;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

.inline-form-submit:hover {
  background: #357abd;
}

.inline-form-cancel {
  flex: 1;
  padding: 5px 0;
  background: #f0f0f0;
  color: #555;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
}

.inline-form-cancel:hover {
  background: #e0e0e0;
}

input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
}
</style>
