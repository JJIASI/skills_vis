import { ref } from "vue"

export function useWorkspaceUi() {
  const contextMenuVisible = ref(false)
  const contextMenuNode = ref(null)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)

  const showContextMenu = (node, x, y) => {
    contextMenuNode.value = node
    contextMenuX.value = x
    contextMenuY.value = y
    contextMenuVisible.value = true
  }

  const hideContextMenu = () => {
    contextMenuVisible.value = false
  }

  return {
    contextMenuVisible,
    contextMenuNode,
    contextMenuX,
    contextMenuY,
    showContextMenu,
    hideContextMenu,
  }
}
