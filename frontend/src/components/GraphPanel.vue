<template>
  <div
    ref="hostRef"
    class="graph-canvas-host"
    data-test="graph-panel-surface"
    @contextmenu.prevent
  >
    <canvas
      ref="canvasRef"
      data-test="graph-canvas"
      :style="{ cursor: canvasCursor }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @lostpointercapture="onPointerCancel"
      @contextmenu.prevent="onContextMenu"
      @wheel.prevent="onWheel"
    />

    <!-- Rect-zoom selection overlay -->
    <svg v-if="rectZoomMode" class="rect-zoom-overlay" aria-hidden="true">
      <rect
        v-if="rectZoomDrag"
        :x="Math.min(rectZoomDrag.x1, rectZoomDrag.x2)"
        :y="Math.min(rectZoomDrag.y1, rectZoomDrag.y2)"
        :width="Math.abs(rectZoomDrag.x2 - rectZoomDrag.x1)"
        :height="Math.abs(rectZoomDrag.y2 - rectZoomDrag.y1)"
        fill="rgba(70,130,220,0.1)"
        stroke="#4682dc"
        stroke-width="1.5"
        stroke-dasharray="4 3"
      />
    </svg>

    <!-- Search + filter chips overlay -->
    <div class="graph-overlay-toolbar">
      <div class="canvas-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted); flex-shrink: 0;" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input
          ref="searchInputRef"
          :value="searchQuery"
          data-test="graph-search-input"
          class="canvas-search-input"
          type="text"
          :placeholder="t('graph.filterPlaceholder')"
          @input="onSearchInput"
          @keydown.enter="onSearchKeydown"
          @keydown.esc="$emit('update:searchQuery', '')"
        />
        <span v-if="totalSearchMatches > 0" data-test="graph-search-count" class="canvas-search-count">
          {{ activeSearchMatchNumber }}/{{ totalSearchMatches }}
        </span>
        <span v-else style="font-family: 'Geist Mono', monospace; font-size: 10.5px; color: var(--muted);">/</span>
      </div>

      <span
        :class="['graph-chip', reorderByMtime ? 'on' : '']"
        :title="t('graph.sortByMtime')"
        @click="toggleReorderByMtime"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        {{ t('graph.recentlyModified') }}
      </span>
    </div>

    <!-- Canvas toolbar -->
    <div class="canvas-toolbar" data-test="canvas-toolbar">
      <button class="canvas-btn" :title="t('graph.zoomIn')" :aria-label="t('graph.zoomIn')" @click="zoomIn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
          <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="canvas-btn" :title="t('graph.zoomOut')" :aria-label="t('graph.zoomOut')" @click="zoomOut">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
          <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="canvas-btn" :title="t('graph.fitGraph')" :aria-label="t('graph.fitGraph')" @click="fitToGraph">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 5V1h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 1h4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M13 9v4H9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 13H1V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        class="canvas-btn"
        :class="{ 'canvas-btn--active': rectZoomMode }"
        :title="t('graph.rectZoom')"
        :aria-label="t('graph.rectZoom')"
        @click="toggleRectZoom"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="11" height="11" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.5 2" rx="1"/>
          <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        class="canvas-btn"
        :class="{ 'canvas-btn--active': reorderByMtime }"
        :title="t('graph.sortByMtime')"
        :aria-label="t('graph.sortByMtime')"
        @click="toggleReorderByMtime"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.2"/>
          <line x1="7" y1="3" x2="7" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="7" y1="7" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M11 5L13 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M13 3L13 5L11 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <p v-if="panelState === 'empty'" data-test="graph-empty" class="fallback">{{ t('graph.noData') }}</p>
    <p v-if="panelState === 'error'" data-test="graph-error" class="fallback">{{ t('graph.renderError') }}</p>

    <!-- Graph legend -->
    <div class="graph-legend" aria-hidden="true">
      <span class="lg"><span class="lg-swatch"/> {{ t('graph.legendFolder') }}</span>
      <span class="lg"><span class="lg-swatch skill"/> {{ t('graph.legendSkill') }}</span>
      <span class="lg"><span class="lg-swatch file"/> {{ t('graph.legendFile') }}</span>
      <span class="lg"><span class="lg-swatch recent"/> {{ t('graph.legendRecent') }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { renderScene } from "./graph/canvasRenderer.js";
import { hitTestScene } from "./graph/hitTest.js";
import { buildScene } from "./graph/sceneModel.js";
import { planTransition } from "./graph/transitionModel.js";
import { MAX_SCALE, MIN_SCALE, clampScale, sceneToScreen, screenToScene, zoomAtPoint } from "./graph/transform.js";

const { t } = useI18n();

const props = defineProps({
  tree: { type: Object, default: null },
  expanded: { type: Object, default: () => ({}) },
  selectedNode: { type: Object, default: null },
  transform: { type: Object, default: () => ({ x: 40, y: 40, scale: 1 }) },
  reorderByMtime: { type: Boolean, default: false },
  searchQuery: { type: String, default: "" },
  searchMatches: { type: Array, default: () => [] },
  activeSearchPath: { type: String, default: null },
  loadingPaths: { type: Object, default: () => new Set() },
  activePaths: { type: Object, default: () => new Set() },
});

const emit = defineEmits([
  "select",
  "toggle",
  "context-menu",
  "update:transform",
  "update:reorderByMtime",
  "update:searchQuery",
  "next-search-match",
  "prev-search-match",
]);

const hostRef = ref(null);
const canvasRef = ref(null);
const searchInputRef = ref(null);
const panelState = ref("empty");
const dpr = ref(1);
const hostSize = ref({ width: 0, height: 0 });
const hoveredPath = ref(null);
const rafId = ref(0);
const isTouchCapable = ref(false);
const isDragging = ref(false);
const rectZoomMode = ref(false);
const rectZoomDrag = ref(null); // { x1, y1, x2, y2 } canvas-relative px
const transitionFrame = ref(null);
const isAnimating = ref(false);
const animationSessionId = ref(0);
const animationFrameCount = ref(0);

const ANIMATION_DURATION_MS = 180;
const ANIMATION_CHANGE_THRESHOLD = 80;

const canvasCursor = computed(() => {
  if (rectZoomMode.value) return "crosshair";
  if (isDragging.value) return "grabbing";
  if (hoveredPath.value !== null) return "pointer";
  return "grab";
});

const totalSearchMatches = computed(() => props.searchMatches.length);
const activeSearchMatchNumber = computed(() => {
  if (!props.activeSearchPath) return 0;
  const index = props.searchMatches.indexOf(props.activeSearchPath);
  return index >= 0 ? index + 1 : 0;
});

let resizeObserver = null;
let ctx = null;
const activePointers = new Map();
let pinchDistance = null;
let hadMultiTouchGesture = false;
let animationRafId = 0;
const stableSceneSnapshot = ref(null);

// Momentum / inertia state
let momentumRafId = null;
const velocitySamples = []; // { x, y, t } — recent pointer positions during drag

function recordVelocitySample(x, y) {
  const t = performance.now();
  velocitySamples.push({ x, y, t });
  if (velocitySamples.length > 6) velocitySamples.shift();
}

function computeReleaseVelocity() {
  if (velocitySamples.length < 2) return { vx: 0, vy: 0 };
  const newest = velocitySamples[velocitySamples.length - 1];
  const oldest = velocitySamples[0];
  const dt = newest.t - oldest.t;
  if (dt < 1) return { vx: 0, vy: 0 };
  return { vx: (newest.x - oldest.x) / dt, vy: (newest.y - oldest.y) / dt };
}

function stopMomentum() {
  if (momentumRafId) {
    cancelAnimationFrame(momentumRafId);
    momentumRafId = null;
  }
}

function startMomentum(startPos, vel) {
  stopMomentum();
  // Scale px/ms velocity to ~px/frame at 60 fps, then decay with friction each frame.
  let vx = vel.vx * 16;
  let vy = vel.vy * 16;
  if (Math.hypot(vx, vy) < 1) return; // not worth animating
  let pos = { ...startPos };
  const FRICTION = 0.95;
  const MIN_SPEED = 0.5;

  function step() {
    vx *= FRICTION;
    vy *= FRICTION;
    if (Math.hypot(vx, vy) < MIN_SPEED) {
      momentumRafId = null;
      return;
    }
    pos.x += vx;
    pos.y += vy;
    emitTransform({ x: pos.x, y: pos.y, scale: localTransform.value.scale });
    momentumRafId = requestAnimationFrame(step);
  }
  momentumRafId = requestAnimationFrame(step);
}

const localTransform = computed(() => ({
  x: Number(props.transform?.x ?? 40),
  y: Number(props.transform?.y ?? 40),
  scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(props.transform?.scale ?? 1))),
}));
const reorderByMtime = computed(() => !!props.reorderByMtime);

const scene = computed(() => {
  const measureText = (text) => {
    if (!ctx || typeof ctx.measureText !== "function") return String(text ?? "").length * 7;
    return ctx.measureText(String(text ?? "")).width;
  };
  return buildScene({
    tree: props.tree,
    expanded: props.expanded,
    selectedPath: props.selectedNode?.path ?? null,
    searchMatchPaths: props.searchMatches,
    activeSearchPath: props.activeSearchPath,
    measureText,
    reorderByMtime: reorderByMtime.value,
    loadingPaths: props.loadingPaths ?? new Set(),
  });
});

function cloneSceneForTransition(sceneData) {
  return {
    ...sceneData,
    nodes: (sceneData.nodes ?? []).map((node) => ({ ...node })),
    edges: (sceneData.edges ?? []).map((edge) => ({ ...edge })),
  };
}

function currentVisibleSceneSnapshot() {
  if (transitionFrame.value) {
    return {
      status: "ready",
      labelFont: scene.value.labelFont,
      bounds: scene.value.bounds,
      nodes: transitionFrame.value.nodes.map((node) => ({ ...node })),
      edges: transitionFrame.value.edges.map((edge) => ({ ...edge })),
    };
  }
  if (stableSceneSnapshot.value) return cloneSceneForTransition(stableSceneSnapshot.value);
  if (scene.value.status === "ready") return cloneSceneForTransition(scene.value);
  return null;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function buildTransitionFrame(fromScene, toScene, plan, progress) {
  const fromByPath = new Map((fromScene.nodes ?? []).map((node) => [node.path, node]));
  const toByPath = new Map((toScene.nodes ?? []).map((node) => [node.path, node]));
  const nodeFrames = [];
  const nodePositions = new Map();

  for (const match of plan.matched) {
    const fromNode = fromByPath.get(match.path);
    const toNode = toByPath.get(match.path);
    const baseNode = toNode ?? fromNode;
    if (!baseNode) continue;
    const x = lerp(match.from.x, match.to.x, progress);
    const y = lerp(match.from.y, match.to.y, progress);
    const frameNode = { ...baseNode, x, y, alpha: 1 };
    nodeFrames.push(frameNode);
    nodePositions.set(frameNode.path, { x, y });
  }

  for (const entering of plan.entering) {
    const toNode = toByPath.get(entering.path);
    if (!toNode) continue;
    const anchor = entering.anchor ?? { x: toNode.x, y: toNode.y };
    const x = lerp(anchor.x, toNode.x, progress);
    const y = lerp(anchor.y, toNode.y, progress);
    const frameNode = { ...toNode, x, y, alpha: progress };
    nodeFrames.push(frameNode);
    nodePositions.set(frameNode.path, { x, y });
  }

  for (const exiting of plan.exiting) {
    const fromNode = fromByPath.get(exiting.path);
    if (!fromNode) continue;
    const anchor = exiting.anchor ?? { x: fromNode.x, y: fromNode.y };
    const x = lerp(fromNode.x, anchor.x, progress);
    const y = lerp(fromNode.y, anchor.y, progress);
    const frameNode = { ...fromNode, x, y, alpha: 1 - progress };
    nodeFrames.push(frameNode);
    nodePositions.set(frameNode.path, { x, y });
  }

  const toEdges = new Map((toScene.edges ?? []).map((edge) => [edge.id, edge]));
  const fromEdges = new Map((fromScene.edges ?? []).map((edge) => [edge.id, edge]));
  const allEdgeIds = Array.from(new Set([...fromEdges.keys(), ...toEdges.keys()])).sort();
  const edgeFrames = allEdgeIds.map((edgeId) => {
    const fromEdge = fromEdges.get(edgeId);
    const toEdge = toEdges.get(edgeId);
    const edge = toEdge ?? fromEdge;
    const [fromPath, toPath] = String(edgeId).split("->");
    const p1 = nodePositions.get(fromPath);
    const p2 = nodePositions.get(toPath);

    if (fromEdge && toEdge) {
      return {
        id: edgeId,
        x1: lerp(fromEdge.x1, toEdge.x1, progress),
        y1: lerp(fromEdge.y1, toEdge.y1, progress),
        x2: lerp(fromEdge.x2, toEdge.x2, progress),
        y2: lerp(fromEdge.y2, toEdge.y2, progress),
        alpha: 1,
      };
    }

    if (toEdge) {
      return {
        id: edgeId,
        x1: p1?.x ?? toEdge.x1,
        y1: p1?.y ?? toEdge.y1,
        x2: p2?.x ?? toEdge.x2,
        y2: p2?.y ?? toEdge.y2,
        alpha: progress,
      };
    }

    return {
      id: edgeId,
      x1: p1?.x ?? edge.x1,
      y1: p1?.y ?? edge.y1,
      x2: p2?.x ?? edge.x2,
      y2: p2?.y ?? edge.y2,
      alpha: 1 - progress,
    };
  });

  return {
    nodes: nodeFrames.sort((a, b) => a.path.localeCompare(b.path)),
    edges: edgeFrames,
  };
}

function stopSceneAnimation() {
  if (animationRafId) {
    cancelAnimationFrame(animationRafId);
    animationRafId = 0;
  }
  isAnimating.value = false;
  transitionFrame.value = null;
}

function startSceneAnimation(fromScene, toScene) {
  const plan = planTransition(fromScene, toScene);
  if (!plan.changedCount || plan.changedCount > ANIMATION_CHANGE_THRESHOLD) {
    stopSceneAnimation();
    stableSceneSnapshot.value = cloneSceneForTransition(toScene);
    scheduleRender();
    return;
  }

  stopSceneAnimation();
  isAnimating.value = true;
  animationSessionId.value += 1;
  const sessionId = animationSessionId.value;
  transitionFrame.value = buildTransitionFrame(fromScene, toScene, plan, 0);
  animationFrameCount.value += 1;
  scheduleRender();
  const startedAt = performance.now();

  const step = (now) => {
    if (sessionId !== animationSessionId.value) return;
    const rawProgress = Math.min(1, (now - startedAt) / ANIMATION_DURATION_MS);
    const easedProgress = easeOutCubic(rawProgress);
    transitionFrame.value = buildTransitionFrame(fromScene, toScene, plan, easedProgress);
    animationFrameCount.value += 1;
    scheduleRender();

    if (rawProgress >= 1) {
      animationRafId = 0;
      isAnimating.value = false;
      transitionFrame.value = null;
      stableSceneSnapshot.value = cloneSceneForTransition(toScene);
      scheduleRender();
      return;
    }
    animationRafId = requestAnimationFrame(step);
  };

  animationRafId = requestAnimationFrame(step);
}

function emitTransform(next) {
  let x = Number(next.x);
  let y = Number(next.y);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(next.scale)));
  if (scene.value.status === "ready" && hostSize.value.width > 0 && hostSize.value.height > 0) {
    const visiblePad = 40;
    const sceneW = scene.value.bounds.width * scale;
    const sceneH = scene.value.bounds.height * scale;
    const minX = -sceneW + visiblePad;
    const maxX = hostSize.value.width - visiblePad;
    const minY = -sceneH + visiblePad;
    const maxY = hostSize.value.height - visiblePad;
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
  }
  emit("update:transform", {
    x,
    y,
    scale,
  });
}

function updateCanvasSize(width, height) {
  if (!canvasRef.value) return;
  canvasRef.value.width = Math.floor(width * dpr.value);
  canvasRef.value.height = Math.floor(height * dpr.value);
  canvasRef.value.style.width = `${width}px`;
  canvasRef.value.style.height = `${height}px`;
}

function measureHost() {
  if (!hostRef.value) return;
  try {
    const rect = hostRef.value.getBoundingClientRect();
    hostSize.value = { width: Math.max(0, rect.width), height: Math.max(0, rect.height) };
  } catch {
    panelState.value = "error";
    hostSize.value = { width: 0, height: 0 };
  }
}

function refreshDprAndSize() {
  dpr.value = Math.max(1, Number(window.devicePixelRatio || 1));
  measureHost();
  updateCanvasSize(hostSize.value.width, hostSize.value.height);
}

function render() {
  rafId.value = 0;
  if (!canvasRef.value) {
    panelState.value = "error";
    return;
  }
  if (!ctx) {
    ctx = canvasRef.value.getContext("2d");
  }
  if (!ctx) {
    panelState.value = "error";
    return;
  }
  if (!props.tree) {
    panelState.value = "empty";
    return;
  }
  if (hostSize.value.width <= 0 || hostSize.value.height <= 0) {
    panelState.value = "suspended";
    return;
  }
  if (scene.value.status === "error") {
    panelState.value = "error";
    return;
  }
  panelState.value = scene.value.status;
  if (scene.value.status !== "ready") return;
  if (!isAnimating.value) {
    stableSceneSnapshot.value = cloneSceneForTransition(scene.value);
  }

  renderScene(ctx, {
    scene: scene.value,
    transform: localTransform.value,
    dpr: dpr.value,
    width: hostSize.value.width,
    height: hostSize.value.height,
    hoverPath: hoveredPath.value,
    alwaysShowHotspots: isTouchCapable.value || (activePointers.size > 0 && [...activePointers.values()].some((p) => p.type === "touch")),
    transitionFrame: isAnimating.value ? transitionFrame.value : null,
    activePaths: props.activePaths,
  });
}

function scheduleRender() {
  if (rafId.value) return;
  rafId.value = requestAnimationFrame(render);
}

function scenePointFromEvent(event) {
  const rect = canvasRef.value.getBoundingClientRect();
  return screenToScene({ x: event.clientX, y: event.clientY }, rect, dpr.value, localTransform.value);
}

function updateHoverFromEvent(event) {
  if (scene.value.status !== "ready") return;
  const hit = hitTestScene(scene.value, scenePointFromEvent(event));
  hoveredPath.value = hit.node?.path ?? null;
}

function onContextMenu(event) {
  if (scene.value.status !== "ready") return;
  const hit = hitTestScene(scene.value, scenePointFromEvent(event));
  if (hit.kind === "node" || hit.kind === "label") {
    emit("context-menu", {
      node: hit.node.source,
      x: event.clientX,
      y: event.clientY,
    });
  }
}

function onWheel(event) {
  if (scene.value.status !== "ready") return;
  const scenePoint = scenePointFromEvent(event);
  const factor = event.deltaY < 0 ? 1.1 : 0.9;
  emitTransform(zoomAtPoint(localTransform.value, factor, scenePoint));
}

function onSearchInput(event) {
  emit("update:searchQuery", event?.target?.value ?? "");
}

function onSearchKeydown(event) {
  event.preventDefault();
  if (!props.searchMatches.length) return;
  if (event.shiftKey) {
    emit("prev-search-match");
    return;
  }
  emit("next-search-match");
}

function focusActiveSearchPath(path) {
  if (!path || scene.value.status !== "ready") return;
  if (hostSize.value.width <= 0 || hostSize.value.height <= 0) return;
  const node = scene.value.nodes.find((item) => item.path === path);
  if (!node) return;
  const scale = localTransform.value.scale;
  emitTransform({
    x: hostSize.value.width / 2 - node.x * scale,
    y: hostSize.value.height / 2 - node.y * scale,
    scale,
  });
}

// ── Canvas toolbar actions ────────────────────────────────────────────────────

function viewportCenterScene() {
  if (!canvasRef.value) return { x: 0, y: 0 };
  const rect = canvasRef.value.getBoundingClientRect();
  return screenToScene(
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    rect,
    dpr.value,
    localTransform.value,
  );
}

function zoomIn() {
  if (scene.value.status !== "ready") return;
  emitTransform(zoomAtPoint(localTransform.value, 1.25, viewportCenterScene()));
}

function zoomOut() {
  if (scene.value.status !== "ready") return;
  emitTransform(zoomAtPoint(localTransform.value, 0.8, viewportCenterScene()));
}

function fitToGraph() {
  if (scene.value.status !== "ready") return;
  const { bounds } = scene.value;
  const { width: vw, height: vh } = hostSize.value;
  if (bounds.width <= 0 || bounds.height <= 0 || vw <= 0 || vh <= 0) return;
  const padding = 40;
  const scale = clampScale(Math.min((vw - padding * 2) / bounds.width, (vh - padding * 2) / bounds.height));
  emitTransform({ x: (vw - bounds.width * scale) / 2, y: (vh - bounds.height * scale) / 2, scale });
}

function toggleRectZoom() {
  rectZoomMode.value = !rectZoomMode.value;
  rectZoomDrag.value = null;
}

function toggleReorderByMtime() {
  emit("update:reorderByMtime", !reorderByMtime.value);
}

function canvasRelativePos(event) {
  const rect = canvasRef.value.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function applyRectZoom() {
  const drag = rectZoomDrag.value;
  if (!drag) return;
  const { width: vw, height: vh } = hostSize.value;
  const rect = canvasRef.value.getBoundingClientRect();
  const p1 = screenToScene({ x: rect.left + drag.x1, y: rect.top + drag.y1 }, rect, dpr.value, localTransform.value);
  const p2 = screenToScene({ x: rect.left + drag.x2, y: rect.top + drag.y2 }, rect, dpr.value, localTransform.value);
  const sceneW = Math.abs(p2.x - p1.x);
  const sceneH = Math.abs(p2.y - p1.y);
  if (sceneW < 4 && sceneH < 4) return;
  const padding = 20;
  const scale = clampScale(Math.min((vw - padding * 2) / sceneW, (vh - padding * 2) / sceneH));
  const sceneMinX = Math.min(p1.x, p2.x);
  const sceneMinY = Math.min(p1.y, p2.y);
  emitTransform({ x: (vw - sceneW * scale) / 2 - sceneMinX * scale, y: (vh - sceneH * scale) / 2 - sceneMinY * scale, scale });
}

// ─────────────────────────────────────────────────────────────────────────────

let pointerDown = null;
const DRAG_THRESHOLD = 4;

function onPointerDown(event) {
  event.preventDefault();
  if (!canvasRef.value || scene.value.status !== "ready") return;
  stopMomentum();
  velocitySamples.length = 0;

  if (rectZoomMode.value) {
    const pos = canvasRelativePos(event);
    rectZoomDrag.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
    canvasRef.value.setPointerCapture?.(event.pointerId);
    return;
  }

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
  canvasRef.value.setPointerCapture?.(event.pointerId);
  updateHoverFromEvent(event);

  if (activePointers.size === 2) {
    const pts = [...activePointers.values()];
    pinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    hadMultiTouchGesture = true;
    scheduleRender();
  }

  const hit = hitTestScene(scene.value, scenePointFromEvent(event));

  pointerDown = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button ?? 0,
    startX: event.clientX,
    startY: event.clientY,
    transform: { ...localTransform.value },
    hit,
    dragged: false,
  };
}

function onPointerMove(event) {
  if (rectZoomMode.value && rectZoomDrag.value) {
    const pos = canvasRelativePos(event);
    rectZoomDrag.value = { ...rectZoomDrag.value, x2: pos.x, y2: pos.y };
    return;
  }

  if (!activePointers.has(event.pointerId)) {
    updateHoverFromEvent(event);
    scheduleRender();
    return;
  }

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });

  if (activePointers.size === 2) {
    const points = [...activePointers.values()];
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    if (pinchDistance) {
      const midpoint = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
      const scenePoint = screenToScene(midpoint, canvasRef.value.getBoundingClientRect(), dpr.value, localTransform.value);
      emitTransform(zoomAtPoint(localTransform.value, distance / pinchDistance, scenePoint));
    }
    pinchDistance = distance;
    return;
  }

  if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;

  const dx = event.clientX - pointerDown.startX;
  const dy = event.clientY - pointerDown.startY;
  if (!pointerDown.dragged && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
    pointerDown.dragged = true;
    isDragging.value = true;
  }
  if (pointerDown.dragged) {
    recordVelocitySample(event.clientX, event.clientY);
    emitTransform({
      x: pointerDown.transform.x + dx,
      y: pointerDown.transform.y + dy,
      scale: pointerDown.transform.scale,
    });
  } else {
    updateHoverFromEvent(event);
  }
}

function onPointerUp(event) {
  if (rectZoomMode.value && rectZoomDrag.value) {
    applyRectZoom();
    rectZoomDrag.value = null;
    rectZoomMode.value = false;
    canvasRef.value?.releasePointerCapture?.(event.pointerId);
    scheduleRender();
    return;
  }

  if (!pointerDown || pointerDown.pointerId !== event.pointerId) {
    activePointers.delete(event.pointerId);
    if (activePointers.size === 0) {
      hadMultiTouchGesture = false;
      pinchDistance = null;
    }
    scheduleRender();
    return;
  }
  const isPrimaryActivation = pointerDown.pointerType === "touch" || pointerDown.button === 0;
  if (!pointerDown.dragged && !hadMultiTouchGesture && isPrimaryActivation) {
    if (pointerDown.hit.kind === "node" || pointerDown.hit.kind === "label") {
      emit("select", pointerDown.hit.node.source);
      if (pointerDown.hit.node.type === "folder") {
        emit("toggle", pointerDown.hit.node.path);
      }
    }
  } else if (pointerDown.dragged) {
    const vel = computeReleaseVelocity();
    const currentPos = { x: localTransform.value.x, y: localTransform.value.y };
    startMomentum(currentPos, vel);
  }
  isDragging.value = false;
  activePointers.delete(event.pointerId);
  pointerDown = null;
  if (activePointers.size < 2) pinchDistance = null;
  if (activePointers.size === 0) hadMultiTouchGesture = false;
  scheduleRender();
}

function onPointerCancel(event) {
  if (rectZoomMode.value) {
    rectZoomDrag.value = null;
    return;
  }
  activePointers.delete(event.pointerId);
  pointerDown = null;
  hoveredPath.value = null;
  isDragging.value = false;
  pinchDistance = null;
  stopMomentum();
  if (activePointers.size === 0) hadMultiTouchGesture = false;
  scheduleRender();
}

function onViewportChanged() {
  refreshDprAndSize();
  if (scene.value.status === "ready") {
    emitTransform(localTransform.value);
  }
  scheduleRender();
}

onMounted(async () => {
  await nextTick();
  if (!canvasRef.value) {
    panelState.value = "error";
    return;
  }
  ctx = canvasRef.value.getContext("2d");
  if (!ctx) {
    panelState.value = "error";
  }

  isTouchCapable.value =
    (typeof window !== "undefined" && "ontouchstart" in window) ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches === true);

  onViewportChanged();
  resizeObserver = new ResizeObserver(() => {
    onViewportChanged();
  });
  resizeObserver.observe(hostRef.value);
  window.addEventListener("focus", onViewportChanged);
  window.visualViewport?.addEventListener?.("resize", onViewportChanged);
  scheduleRender();
});

onBeforeUnmount(() => {
  if (rafId.value) cancelAnimationFrame(rafId.value);
  stopSceneAnimation();
  stopMomentum();
  resizeObserver?.disconnect();
  window.removeEventListener("focus", onViewportChanged);
  window.visualViewport?.removeEventListener?.("resize", onViewportChanged);
});

watch([scene, localTransform], () => {
  scheduleRender();
}, { deep: true });

watch(
  () => props.expanded,
  (_nextExpanded, previousExpanded) => {
    if (!previousExpanded) return;
    if (scene.value.status !== "ready") return;
    const fromScene = isAnimating.value
      ? currentVisibleSceneSnapshot()
      : buildScene({
          tree: props.tree,
          expanded: previousExpanded,
          selectedPath: props.selectedNode?.path ?? null,
          searchMatchPaths: props.searchMatches,
          activeSearchPath: props.activeSearchPath,
          measureText: (text) => {
            if (!ctx || typeof ctx.measureText !== "function") return String(text ?? "").length * 7;
            return ctx.measureText(String(text ?? "")).width;
          },
          reorderByMtime: reorderByMtime.value,
          loadingPaths: props.loadingPaths ?? new Set(),
        });
    const toScene = cloneSceneForTransition(scene.value);
    if (!fromScene || fromScene.status !== "ready") {
      stableSceneSnapshot.value = toScene;
      scheduleRender();
      return;
    }
    startSceneAnimation(fromScene, toScene);
  },
  { deep: true },
);

watch(
  () => props.activeSearchPath,
  (nextPath, previousPath) => {
    if (!nextPath || nextPath === previousPath) return;
    focusActiveSearchPath(nextPath);
  },
);

watch(
  () => props.tree?.path,
  (newPath) => {
    if (!newPath) return;
    nextTick(() => fitToGraph());
  },
);

watch(
  () => reorderByMtime.value,
  () => {
    scheduleRender();
  },
);

watch(
  () => props.activePaths,
  () => { scheduleRender(); },
);

defineExpose({
  focusSearch() {
    searchInputRef.value?.focus();
    searchInputRef.value?.select();
  },
  setHostSizeForTest(width, height) {
    hostSize.value = { width, height };
    updateCanvasSize(width, height);
    scheduleRender();
  },
  tapAtForTest({ x, y, pointerType = "mouse", pointerId = 1 }) {
    const e = { clientX: x, clientY: y, pointerType, pointerId, preventDefault() {} };
    onPointerDown(e);
    onPointerUp(e);
  },
  moveAtForTest({ x, y, pointerType = "mouse", pointerId = 1 }) {
    onPointerMove({ clientX: x, clientY: y, pointerType, pointerId, preventDefault() {} });
  },
  contextMenuAtForTest({ x, y }) {
    onContextMenu({ clientX: x, clientY: y, preventDefault() {} });
  },
  wheelAtForTest({ x, y, deltaY }) {
    onWheel({ clientX: x, clientY: y, deltaY, preventDefault() {} });
  },
  pinchForTest({ startA, startB, moveB }) {
    onPointerDown({ ...startA, preventDefault() {} });
    onPointerDown({ ...startB, preventDefault() {} });
    onPointerMove({ ...moveB, preventDefault() {} });
  },
  dragForTest({ start, move, end }) {
    onPointerDown({ ...start, preventDefault() {} });
    onPointerMove({ ...move, preventDefault() {} });
    onPointerUp({ ...end, preventDefault() {} });
  },
  hoverPathForTest() {
    return hoveredPath.value;
  },
  isAnimatingForTest() {
    return isAnimating.value;
  },
  animationSessionIdForTest() {
    return animationSessionId.value;
  },
  animationFrameCountForTest() {
    return animationFrameCount.value;
  },
});
</script>

<style scoped>
.graph-canvas-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  background: #fafafa;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.rect-zoom-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.canvas-toolbar {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.canvas-search {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.canvas-search-input {
  width: 150px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  outline: none;
}

.canvas-search-input:focus {
  border-color: #4682dc;
}

.canvas-search-count {
  min-width: 28px;
  text-align: right;
  font-size: 11px;
  color: #555;
}

.canvas-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: #444;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.canvas-btn:hover {
  background: #fff;
  border-color: #aac4f8;
  color: #1a56db;
}

.canvas-btn--active {
  background: #e8f0fe;
  border-color: #4682dc;
  color: #1a56db;
}

.fallback {
  position: absolute;
  inset: 0;
  margin: auto;
  width: max-content;
  height: max-content;
  color: #555;
}
</style>
