// Node shape constants — small icon sizes matching the reference design
export const NODE_R = 5;          // file circle radius
export const FOLDER_W = 24;       // folder icon width
export const FOLDER_H = 17;       // folder icon height
export const DIAMOND_SIZE = 12;   // skill diamond half-size
export const X_STEP = 230;        // horizontal spacing per depth level
export const Y_STEP = 50;         // vertical spacing between leaf rows

const LABEL_FONT = "500 12px 'Geist', ui-sans-serif, system-ui, sans-serif";
const TIMESTAMP_LABEL = "—";

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatNodeMtime(mtime) {
  if (typeof mtime !== "number" || !Number.isFinite(mtime) || mtime < 0) return TIMESTAMP_LABEL;
  const date = new Date(mtime * 1000);
  if (Number.isNaN(date.getTime())) return TIMESTAMP_LABEL;
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

export function formatRelativeTime(mtime) {
  if (typeof mtime !== "number" || !Number.isFinite(mtime) || mtime <= 0) return null;
  const diffMs = Date.now() - mtime * 1000;
  if (diffMs < 0) return null;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "yesterday";
  return `${Math.floor(h / 24)}d ago`;
}

function isValidNode(node) {
  return !!node && typeof node.path === "string" && typeof node.name === "string" && typeof node.type === "string";
}

function shapeFor(node) {
  if (node.is_skill) return "diamond";
  if (node.type === "folder") return "folder";
  return "file";
}

export function truncateLabel(text, maxWidth, measure) {
  if (measure(text) <= maxWidth) return text;
  const ellipsis = "…";
  let end = text.length;
  while (end > 0 && measure(text.slice(0, end) + ellipsis) > maxWidth) {
    end -= 1;
  }
  return `${text.slice(0, end)}${ellipsis}`;
}

export function buildScene({
  tree,
  expanded = {},
  selectedPath = null,
  searchMatchPaths = [],
  activeSearchPath = null,
  measureText = (text) => text.length * 7,
  reorderByMtime = false,
  loadingPaths = new Set(),
}) {
  if (!tree) return { status: "empty", nodes: [], edges: [], labelFont: LABEL_FONT };
  if (!isValidNode(tree)) return { status: "error", nodes: [], edges: [], labelFont: LABEL_FONT };

  const safeLoadingPaths = loadingPaths instanceof Set ? loadingPaths : new Set();
  const searchMatches = new Set(searchMatchPaths);

  // ── Phase 1: compute y positions with post-order centering ───────────────
  // Leaves get sequential row numbers; interior nodes center between children.
  let leafRow = 0;
  const posMap = new Map(); // path → { x, y }
  const seenPos = new Set();

  function computePositions(node, depth) {
    if (!isValidNode(node) || seenPos.has(node.path)) return null;
    seenPos.add(node.path);

    const x = depth * X_STEP;
    const isOpen =
      node.type === "folder" &&
      expanded[node.path] &&
      Array.isArray(node.children) &&
      node.children.length > 0;

    if (!isOpen) {
      const y = leafRow * Y_STEP;
      leafRow++;
      posMap.set(node.path, { x, y });
      return y;
    }

    const children = reorderByMtime
      ? [...node.children].sort((a, b) => (b.atime ?? b.mtime ?? 0) - (a.atime ?? a.mtime ?? 0))
      : node.children;

    const childYs = [];
    for (const child of children) {
      const cy = computePositions(child, depth + 1);
      if (cy !== null) childYs.push(cy);
    }

    const y =
      childYs.length > 0
        ? (Math.min(...childYs) + Math.max(...childYs)) / 2
        : (() => { const r = leafRow * Y_STEP; leafRow++; return r; })();

    posMap.set(node.path, { x, y });
    return y;
  }

  computePositions(tree, 0);

  // ── Phase 2: build scene nodes and edges ─────────────────────────────────
  const nodes = [];
  const edges = [];
  const seenBuild = new Set();

  function buildNodes(node, depth, parentPath) {
    if (!isValidNode(node) || seenBuild.has(node.path)) return;
    seenBuild.add(node.path);

    const pos = posMap.get(node.path);
    if (!pos) return;

    const { x, y } = pos;
    const shape = shapeFor(node);
    const isLoading = safeLoadingPaths.has(node.path);
    const rawLabel = isLoading ? `${String(node.name)} …` : String(node.name);

    // Label truncation — cap at available width before next column
    const maxLabelW = X_STEP - DIAMOND_SIZE - 30;
    const label = truncateLabel(rawLabel, maxLabelW, measureText);

    // Hit rect covering the full hover row (icon + gap + label text)
    const leftEdge = shape === "folder" ? FOLDER_W / 2 : shape === "diamond" ? DIAMOND_SIZE : NODE_R;
    const rightEdge = leftEdge + 6;
    const labelW = measureText(label);
    const labelRect = {
      x1: x - leftEdge,
      y1: y - 18,
      x2: x + rightEdge + labelW + 4,
      y2: y + 18,
    };

    const childCount =
      node.type === "folder" && Array.isArray(node.children) ? node.children.length : 0;

    // Meta line text — use atime (last access) when available, fall back to mtime
    const relTime = formatRelativeTime(node.atime ?? node.mtime);
    let metaLabel;
    if (depth === 0) {
      metaLabel = "";
    } else if (shape === "folder") {
      const itemStr = childCount ? `${childCount} item${childCount !== 1 ? "s" : ""}` : "";
      metaLabel = relTime ? (itemStr ? `${itemStr} · ${relTime}` : relTime) : itemStr;
    } else if (shape === "diamond") {
      metaLabel = relTime ? `SKILL.md · ${relTime}` : "SKILL.md";
    } else {
      metaLabel = relTime ?? "";
    }

    const parentNode = parentPath && posMap.has(parentPath) ? posMap.get(parentPath) : null;
    const sceneNode = {
      path: node.path,
      name: node.name,
      type: node.type,
      is_skill: !!node.is_skill,
      mtime: node.mtime ?? null,
      source: node,
      x,
      y,
      depth,
      shape,
      childCount,
      selected: selectedPath === node.path,
      isSearchMatch: searchMatches.has(node.path),
      isActiveSearchMatch: activeSearchPath === node.path,
      label,
      metaLabel,
      labelRect,
      parentAnchor: parentNode ? { x: parentNode.x, y: parentNode.y } : null,
      hasUnloadedChildren: node.type === "folder" && node.children_loaded === false,
      // keep legacy field for any existing code that reads it
      timestampLabel: formatNodeMtime(node.mtime),
    };
    nodes.push(sceneNode);

    if (parentNode) {
      edges.push({
        id: `${parentPath}->${node.path}`,
        x1: parentNode.x,
        y1: parentNode.y,
        x2: x,
        y2: y,
      });
    }

    if (expanded[node.path] && Array.isArray(node.children)) {
      const children = reorderByMtime
        ? [...node.children].sort((a, b) => (b.atime ?? b.mtime ?? 0) - (a.atime ?? a.mtime ?? 0))
        : node.children;
      for (const child of children) buildNodes(child, depth + 1, node.path);
    }
  }

  buildNodes(tree, 0, null);

  return {
    status: "ready",
    nodes,
    edges,
    labelFont: LABEL_FONT,
    bounds: {
      width: nodes.length ? Math.max(...nodes.map((n) => n.x)) + X_STEP : 0,
      height: nodes.length ? Math.max(...nodes.map((n) => n.y)) + Y_STEP : 0,
    },
  };
}
