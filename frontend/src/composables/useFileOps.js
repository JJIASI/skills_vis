import { ref } from "vue"

export function useFileOps(api, state) {
  const {
    rootPath,
    reloadTree,
    currentFile = ref(null),
    selectedNode = ref(null),
  } = state

  async function openFile(path) {
    try {
      const file = await api.getFile(path)
      currentFile.value = file
    } catch (err) {
      if (err?.status === 415) {
        currentFile.value = { path, kind: "binary", content: null }
      } else {
        throw err
      }
    }
  }

  async function saveSelectedFile(nextContent) {
    await api.saveFile(currentFile.value.path, nextContent)
    currentFile.value.content = nextContent
    await reloadTree(rootPath.value)
  }

  async function deleteNode(node) {
    if (node.type === "folder") {
      await api.deleteFolder(node.path)
    } else {
      await api.deleteFile(node.path)
    }

    // Clear selection if deleting the selected node or its parent
    if (selectedNode.value) {
      if (selectedNode.value.path === node.path) {
        selectedNode.value = null
        currentFile.value = null
      } else if (node.type === "folder" && selectedNode.value.path.startsWith(node.path + "/")) {
        // Deleting a parent folder
        selectedNode.value = null
        currentFile.value = null
      }
    }

    await reloadTree(rootPath.value)
  }

  async function renameNode(node, newName) {
    const response = await api.renamePath(node.path, newName)
    const newPath = response.path
    const oldPath = node.path

    // Update selectedNode if it's the renamed node or a descendant
    if (selectedNode.value) {
      if (selectedNode.value.path === oldPath) {
        // Renamed the selected node itself
        selectedNode.value.path = newPath
        selectedNode.value.name = newName
      } else if (node.type === "folder" && selectedNode.value.path.startsWith(oldPath + "/")) {
        // Renamed a parent folder - retarget descendants
        const relativePath = selectedNode.value.path.substring(oldPath.length)
        selectedNode.value.path = newPath + relativePath
      }
    }

    // Update currentFile if it references the renamed node or a descendant
    if (currentFile.value) {
      if (currentFile.value.path === oldPath) {
        // Renamed the current file
        currentFile.value.path = newPath
      } else if (node.type === "folder" && currentFile.value.path.startsWith(oldPath + "/")) {
        // Renamed a parent folder - retarget descendants
        const relativePath = currentFile.value.path.substring(oldPath.length)
        currentFile.value.path = newPath + relativePath
      }
    }

    await reloadTree(rootPath.value)
  }

  async function createFileAtNode(node, name) {
    const newPath = node.path + "/" + name
    await api.createFile(newPath, "")
    await reloadTree(rootPath.value)
  }

  async function createFolderAtNode(node, name) {
    const newPath = node.path + "/" + name
    await api.createFolder(newPath)
    await reloadTree(rootPath.value)
  }

  return {
    openFile,
    saveSelectedFile,
    deleteNode,
    renameNode,
    createFileAtNode,
    createFolderAtNode,
  }
}
