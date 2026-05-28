import { DIAMOND_SIZE, FOLDER_H, FOLDER_W, NODE_R } from "./sceneModel.js";

const _EMPTY_PATHS = Object.freeze(new Set());

// ── Node shape drawing ───────────────────────────────────────────────────────

function drawRoundRect(ctx, cx, cy, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
  } else {
    ctx.rect(cx - w / 2, cy - h / 2, w, h);
  }
}

function drawNodeShape(ctx, node, colors) {
  const { x, y, shape, depth, is_skill } = node;

  if (shape === "folder" && depth === 0) {
    // ── Root: black badge with "/" text ────────────────────────────────────
    const w = 34, h = 24, r = 7;
    ctx.beginPath();
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = colors.rootFill;
    ctx.fill();
    // White "/" text
    ctx.save();
    ctx.fillStyle = colors.rootText;
    ctx.font = "bold 13px 'Geist Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("/", x, y + 1);
    ctx.restore();

  } else if (shape === "folder") {
    // ── Folder: small rounded rect with "–" icon ──────────────────────────
    ctx.beginPath();
    drawRoundRect(ctx, x, y, FOLDER_W, FOLDER_H, 3);
    ctx.fillStyle = colors.folderFill;
    ctx.strokeStyle = colors.folderStroke;
    ctx.lineWidth = node.selected ? 2 : 1.25;
    ctx.fill();
    ctx.stroke();
    // "–" dash line inside
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.strokeStyle = colors.folderIcon;
    ctx.lineWidth = 1.5;
    ctx.stroke();

  } else if (shape === "diamond") {
    // ── Skill: rotated square (diamond) ──────────────────────────────────
    const ds = DIAMOND_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y - ds);
    ctx.lineTo(x + ds, y);
    ctx.lineTo(x, y + ds);
    ctx.lineTo(x - ds, y);
    ctx.closePath();
    ctx.fillStyle = node.selected ? colors.diamondActiveFill : colors.diamondFill;
    ctx.strokeStyle = colors.diamondStroke;
    ctx.lineWidth = node.selected ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();

  } else {
    // ── File: small circle ────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = colors.circleFill;
    ctx.strokeStyle = colors.circleStroke;
    ctx.lineWidth = 1.25;
    ctx.fill();
    ctx.stroke();
  }
}

function drawSearchHighlight(ctx, node) {
  if (!node.isSearchMatch) return;
  const accentColor = node.isActiveSearchMatch ? "#f59e0b" : "#8a857d";
  const lw = node.isActiveSearchMatch ? 2.5 : 1.5;
  const pad = 4;
  ctx.beginPath();
  if (node.shape === "folder") {
    drawRoundRect(ctx, node.x, node.y, FOLDER_W + pad * 2, FOLDER_H + pad * 2, 5);
  } else if (node.shape === "diamond") {
    const s = DIAMOND_SIZE + pad;
    ctx.moveTo(node.x, node.y - s);
    ctx.lineTo(node.x + s, node.y);
    ctx.lineTo(node.x, node.y + s);
    ctx.lineTo(node.x - s, node.y);
    ctx.closePath();
  } else {
    ctx.arc(node.x, node.y, NODE_R + pad, 0, Math.PI * 2);
  }
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = lw;
  ctx.stroke();
}

export const ACTIVE_NODE_FADE_MS = 3000;
export { _isNodeActive };

function _isNodeActive(node, activePaths) {
  if (activePaths.size === 0) return false;
  if (activePaths.has(node.path)) return true;
  for (const p of activePaths) {
    if (p.includes('/') && p.slice(0, p.lastIndexOf('/')) === node.path) return true;
    const base = p.split('/').pop().replace(/\.md$/i, '');
    if (base && (node.path.endsWith('/' + base) || node.path === base)) return true;
  }
  return false;
}

function drawActiveGlow(ctx, node) {
  const r =
    node.shape === "folder"
      ? Math.max(FOLDER_W, FOLDER_H) / 2 + 4
      : node.shape === "diamond"
      ? DIAMOND_SIZE + 4
      : NODE_R + 4;
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Label helpers ────────────────────────────────────────────────────────────

// Horizontal offset from node center to where label text starts
function labelStartX(node) {
  if (node.shape === "folder" && node.depth === 0) return 20;   // root badge half-width + gap
  if (node.shape === "folder") return FOLDER_W / 2 + 6;        // folder rect right edge + gap
  if (node.shape === "diamond") return DIAMOND_SIZE + 6;        // diamond tip + gap
  return NODE_R + 6;                                            // file circle + gap
}

// ── Main render function ─────────────────────────────────────────────────────

export function renderScene(
  ctx,
  { scene, transform, dpr, width, height, hoverPath, transitionFrame = null, activePaths = _EMPTY_PATHS },
) {
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const colors = dark
    ? {
        bg:               "#0c0b0a",
        edge:             "#3d362e",
        rootFill:         "#f6f4ef",  // light in dark mode (inverted badge)
        rootText:         "#0c0b0a",
        folderFill:       "#221f1c",
        folderStroke:     "#3d362e",
        folderIcon:       "#5e5a52",
        diamondFill:      "#1c1610",
        diamondActiveFill:"#f59e0b",
        diamondStroke:    "#f59e0b",
        circleFill:       "#221f1c",
        circleStroke:     "#5e5a52",
        label:            "#f6f4ef",
        labelBold:        "#f6f4ef",
        meta:             "#8a857d",
        hover:            "#2c2722",
      }
    : {
        bg:               "#faf9f7",
        edge:             "#dcd7cf",
        rootFill:         "#0d0c0a",  // dark badge
        rootText:         "#faf9f7",
        folderFill:       "#ffffff",
        folderStroke:     "#c9c4ba",
        folderIcon:       "#8a857d",
        diamondFill:      "#ffffff",
        diamondActiveFill:"#f59e0b",
        diamondStroke:    "#f59e0b",
        circleFill:       "#ffffff",
        circleStroke:     "#c9c4ba",
        label:            "#0d0c0a",
        labelBold:        "#0d0c0a",
        meta:             "#8a857d",
        hover:            "#f0ede8",
      };

  // Canvas setup
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  // Viewport culling
  const PAD = 120;
  const { x: tx, y: ty, scale } = transform;
  const isDegenerate =
    !Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(scale) || scale === 0;

  let cullBounds = null;
  if (!isDegenerate) {
    cullBounds = {
      left:   (-tx / scale) - PAD,
      top:    (-ty / scale) - PAD,
      right:  ((width  - tx) / scale) + PAD,
      bottom: ((height - ty) / scale) + PAD,
    };
  }

  function isNodeCulled(node) {
    if (!cullBounds) return false;
    const hw = node.shape === "folder" ? FOLDER_W / 2 + 120 : NODE_R + 120;
    const hh = node.shape === "folder" ? FOLDER_H / 2 + 20 : NODE_R + 20;
    return (
      node.x + hw < cullBounds.left  || node.x - hw > cullBounds.right ||
      node.y + hh < cullBounds.top   || node.y - hh > cullBounds.bottom
    );
  }

  function isEdgeCulled(x1, y1, x2, y2) {
    if (!cullBounds) return false;
    if (x1 < cullBounds.left   && x2 < cullBounds.left)   return true;
    if (x1 > cullBounds.right  && x2 > cullBounds.right)  return true;
    if (y1 < cullBounds.top    && y2 < cullBounds.top)     return true;
    if (y1 > cullBounds.bottom && y2 > cullBounds.bottom)  return true;
    return false;
  }

  const edges = transitionFrame?.edges ?? scene.edges;
  const nodes = transitionFrame?.nodes ?? scene.nodes;
  const transitionActive = Boolean(transitionFrame);

  const culledPaths = new Set();
  for (const node of nodes) {
    if (isNodeCulled(node)) culledPaths.add(node.path);
  }

  // ── Draw edges ────────────────────────────────────────────────────────────
  for (const edge of edges) {
    if (isEdgeCulled(edge.x1, edge.y1, edge.x2, edge.y2)) continue;
    if (transitionActive) ctx.globalAlpha = edge.alpha ?? 1;
    const c = Math.max(Math.abs(edge.x2 - edge.x1) / 2, 20);
    ctx.beginPath();
    ctx.moveTo(edge.x1, edge.y1);
    ctx.bezierCurveTo(edge.x1 + c, edge.y1, edge.x2 - c, edge.y2, edge.x2, edge.y2);
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  if (transitionActive) ctx.globalAlpha = 1;

  // ── Draw hover background ─────────────────────────────────────────────────
  if (hoverPath) {
    const hov = nodes.find(n => n.path === hoverPath);
    if (hov && !culledPaths.has(hov.path)) {
      const lx = hov.x + labelStartX(hov);
      const labelW = 160;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(hov.x - (hov.depth === 0 ? 17 : 10), hov.y - 18, labelW + 24, 36, 6);
      } else {
        ctx.rect(hov.x - 10, hov.y - 18, labelW + 24, 36);
      }
      ctx.fillStyle = colors.hover;
      ctx.fill();
    }
  }

  // ── Draw node shapes ──────────────────────────────────────────────────────
  for (const node of nodes) {
    if (culledPaths.has(node.path)) continue;
    if (transitionActive) ctx.globalAlpha = node.alpha ?? 1;
    drawNodeShape(ctx, node, colors);
    drawSearchHighlight(ctx, node);
    if (_isNodeActive(node, activePaths)) drawActiveGlow(ctx, node);
  }
  if (transitionActive) ctx.globalAlpha = 1;

  // ── Draw labels (RIGHT of node) ───────────────────────────────────────────
  for (const node of nodes) {
    if (culledPaths.has(node.path)) continue;
    if (transitionActive) ctx.globalAlpha = node.alpha ?? 1;

    const lx = node.x + labelStartX(node);

    // Name — bold
    const isRoot = node.shape === "folder" && node.depth === 0;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.labelBold;
    ctx.font = isRoot
      ? "600 13px 'Geist', ui-sans-serif, system-ui, sans-serif"
      : "600 12.5px 'Geist', ui-sans-serif, system-ui, sans-serif";

    const displayLabel = node.shape === "folder" && !isRoot
      ? node.label + "/"
      : node.label;

    const hasMetaBelow = node.metaLabel && node.metaLabel.length > 0;
    const nameY = hasMetaBelow ? node.y - 6 : node.y;
    ctx.fillText(displayLabel, lx, nameY);

    // Meta line — muted, smaller
    if (hasMetaBelow) {
      ctx.fillStyle = colors.meta;
      ctx.font = "400 10.5px 'Geist', ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(node.metaLabel, lx, node.y + 8);
    }
  }
  if (transitionActive) ctx.globalAlpha = 1;

  ctx.restore();
}
