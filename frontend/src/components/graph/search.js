function isValidNode(node) {
  return (
    !!node &&
    typeof node.path === "string" &&
    typeof node.name === "string" &&
    typeof node.type === "string"
  );
}

export function collectSearchMatches(tree, query) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery || !isValidNode(tree)) return [];

  const matches = [];
  const seen = new Set();

  function visit(node) {
    if (!isValidNode(node) || seen.has(node.path)) return;
    seen.add(node.path);

    const name = node.name.toLowerCase();
    const path = node.path.toLowerCase();
    if (name.includes(normalizedQuery) || path.includes(normalizedQuery)) {
      matches.push(node.path);
    }

    if (node.type === "folder" && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  visit(tree);
  return matches;
}

export function nextIndex(current, total) {
  if (!Number.isFinite(total) || total <= 0) return -1;
  if (!Number.isFinite(current) || current < 0 || current >= total) return 0;
  return (current + 1) % total;
}

export function prevIndex(current, total) {
  if (!Number.isFinite(total) || total <= 0) return -1;
  if (!Number.isFinite(current) || current < 0 || current >= total) return total - 1;
  return (current - 1 + total) % total;
}

export function collectSearchExpandPaths(tree, matchPaths) {
  if (!isValidNode(tree) || !Array.isArray(matchPaths) || !matchPaths.length) return [];

  const matches = new Set(matchPaths);
  const toExpand = new Set();
  const seen = new Set();

  function visit(node, folderAncestors = []) {
    if (!isValidNode(node) || seen.has(node.path)) return;
    seen.add(node.path);

    const nextAncestors = node.type === "folder"
      ? [...folderAncestors, node.path]
      : folderAncestors;

    if (matches.has(node.path)) {
      for (const path of folderAncestors) {
        toExpand.add(path);
      }
      if (node.type === "folder") {
        toExpand.add(node.path);
      }
    }

    if (node.type === "folder" && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child, nextAncestors);
      }
    }
  }

  visit(tree, []);
  return [...toExpand];
}
