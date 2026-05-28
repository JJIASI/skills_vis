import { ref } from "vue";

export function useTree(api) {
  const rootPath = ref("");
  const tree = ref(null);
  const loading = ref(false);
  const expanded = ref({});
  const selectedNode = ref(null);

  async function loadTree(path) {
    loading.value = true;
    try {
      const data = await api.getTree(path);
      rootPath.value = path;
      tree.value = data;
      expanded.value = {};
      selectedNode.value = null;
    } finally {
      loading.value = false;
    }
  }

  function findNode(node, path) {
    if (node.path === path) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, path);
        if (found) return found;
      }
    }
    return null;
  }

  function clearDescendants(node) {
    if (node.children) {
      for (const child of node.children) {
        if (child.type === "folder") {
          delete expanded.value[child.path];
          clearDescendants(child);
        }
      }
    }
  }

  function toggleNode(path) {
    const isCurrentlyExpanded = expanded.value[path];
    expanded.value[path] = !isCurrentlyExpanded;
    if (isCurrentlyExpanded && tree.value) {
      const node = findNode(tree.value, path);
      if (node) clearDescendants(node);
    }
  }

  function selectNode(node) {
    selectedNode.value = node;
  }

  function graftChildren(path, children) {
    if (!tree.value) return;
    const node = findNode(tree.value, path);
    if (!node) return;
    node.children = children;
    node.children_loaded = true;
  }

  function findTreeNode(path) {
    if (!tree.value) return null;
    return findNode(tree.value, path);
  }

  function expandAll(path) {
    if (!tree.value) return;

    const target = findNode(tree.value, path);
    if (!target) return;

    function expandFolders(node) {
      if (node.type === "folder") {
        expanded.value[node.path] = true;
        if (node.children) {
          for (const child of node.children) {
            expandFolders(child);
          }
        }
      }
    }

    expandFolders(target);
  }

  return { rootPath, tree, loading, loadTree, expanded, selectedNode, toggleNode, selectNode, expandAll, graftChildren, findTreeNode };
}
