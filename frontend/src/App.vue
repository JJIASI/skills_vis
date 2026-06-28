<template>
  <div class="app-layout">
    <!-- Toolbar -->
    <Toolbar
      ref="toolbarRef"
      v-model="rootInput"
      :is-recording="isRecording"
      :is-dark="isDark"
      :skill-count="skillCount"
      @load="handleLoad"
      @open-import="importModalOpen = true"
      @toggle-record="toggleRecord"
      @open-monitor="handleOpenMonitor"
      @open-drawer="handleOpenDrawer"
      @toggle-dark="handleToggleDark"
      data-test="toolbar"
    />

    <!-- Backdrop only for skills drawer (session drawer stays open for skill monitoring) -->
    <Transition name="fade">
      <div
        v-if="drawerOpen"
        class="drawer-backdrop"
        @click="drawerOpen = false"
      />
    </Transition>

    <!-- Overlays -->
    <Transition name="drawer-slide-left">
      <SkillsDrawer
        v-if="drawerOpen"
        :open="drawerOpen"
        :saved="saved"
        :starters="starters"
        :loading="drawerLoading"
        :error="computedDrawerError"
        :active-root-path="tree?.path"
        :server-root-path="serverWorkspacePath"
        @select="handleDrawerSelect"
        @add="handleDrawerAdd"
        @update="handleDrawerUpdate"
        @remove="handleDrawerRemove"
        @add-starter="handleDrawerAddStarter"
        @retry="fetchSkills"
        @close="drawerOpen = false"
      />
    </Transition>

    <Transition name="drawer-slide-right">
      <SessionMonitorDrawer
        v-if="monitorOpen"
        :open="monitorOpen"
        :saved="saved"
        :usage-sessions="usageSessions"
        :is-recording="isRecording"
        :is-replaying="isReplaying"
        :active-paths="activePaths"
        :auto-expand-session-id="replaySessionId"
        @replay-session="handleReplaySession"
        @delete-session="handleDeleteSession"
        @toggle-record="toggleRecord"
        @select-skill="handleSelectSkillFromSession"
        @close="monitorOpen = false"
      />
    </Transition>

    <!-- 2-panel split body -->
    <div class="body" ref="panesRef" :class="{ 'is-dragging': isDragging }">
      <!-- Graph panel -->
      <div class="graph-panel" data-test="graph-panel" :class="{ 'panel--full': fullPanel === 'graph' }" :style="graphPanelStyle">
        <template v-if="fullPanel !== 'editor'">
          <PanelHeader :label="t('app.graph')" :is-expanded="fullPanel === 'graph'" data-test="graph-panel-header" @toggle="toggleFullPanel('graph')" />
          <div v-if="replayRootMismatch" class="replay-root-warning" data-test="replay-root-warning">⚠ This session was recorded with root: {{ replayRootMismatch }}</div>
          <GraphPanel
            ref="graphPanelRef"
            :tree="tree"
            :expanded="expandedWithRoot"
            :selected-node="selectedNode"
            :transform="graphTransform"
            :reorder-by-mtime="graphReorderByMtime"
            :search-query="graphSearchQuery"
            :search-matches="graphSearchMatches"
            :active-search-path="activeSearchPath"
            :active-paths="activePaths"
            :loading-paths="loadingPaths"
            @select="selectNode"
            @toggle="handleToggle"
            @context-menu="handleContextMenu"
            @update:transform="handleTransformUpdate"
            @update:reorder-by-mtime="handleReorderByMtimeUpdate"
            @update:search-query="handleSearchQueryUpdate"
            @next-search-match="handleNextSearchMatch"
            @prev-search-match="handlePrevSearchMatch"
          />
        </template>
        <button v-else class="panel-strip" data-test="graph-strip" :aria-label="t('app.restoreSplitView')" @click="toggleFullPanel('editor')">
          <span class="strip-label">{{ t('app.graph') }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <!-- Drag handle -->
      <div
        class="resize-handle"
        data-test="resize-handle"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('app.resizePanels')"
        tabindex="0"
        :aria-valuenow="ariaValueNow"
        :aria-valuemin="ariaValueMin"
        :aria-valuemax="ariaValueMax"
        @mousedown="startDrag"
        @keydown="handleResizeKey"
      >
        <span class="grip-indicator" aria-hidden="true">⋮⋮</span>
      </div>

      <!-- Editor panel -->
      <div class="editor-panel" data-test="editor-panel" :class="{ 'panel--full': fullPanel === 'editor' }" :style="editorPanelStyle">
        <template v-if="fullPanel !== 'graph'">
          <PanelHeader :label="t('app.fileViewer')" :is-expanded="fullPanel === 'editor'" data-test="editor-panel-header" @toggle="toggleFullPanel('editor')" />
          <EditorPanel
            :current-file="currentFile"
            :selected-node="selectedNode"
            :actions="editorActions"
            :recent-files="recentFiles"
          />
        </template>
        <button v-else class="panel-strip" data-test="editor-strip" :aria-label="t('app.restoreSplitView')" @click="toggleFullPanel('graph')">
          <span class="strip-label">{{ t('app.fileViewer') }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>

    <ContextMenu
      :visible="contextMenuVisible"
      :node="contextMenuNode"
      :x="contextMenuX"
      :y="contextMenuY"
      :actions="contextMenuActions"
      :is-expanded="contextMenuIsExpanded"
      @close="hideContextMenu"
    />
    <ImportSkillsModal
      :open="importModalOpen"
      @close="importModalOpen = false"
      @imported="handleImported"
    />
  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import Toolbar from "./components/Toolbar.vue";
import PanelHeader from "./components/PanelHeader.vue";
import GraphPanel from "./components/GraphPanel.vue";
import EditorPanel from "./components/EditorPanel.vue";
import ContextMenu from "./components/ContextMenu.vue";
import SkillsDrawer from "./components/SkillsDrawer.vue";
import SessionMonitorDrawer from "./components/SessionMonitorDrawer.vue";
import ImportSkillsModal from "./components/ImportSkillsModal.vue";
import { useTree } from "./composables/useTree.js";
import { useFileOps } from "./composables/useFileOps.js";
import { useWorkspaceUi } from "./composables/useWorkspaceUi.js";
import { useSkillsDrawer } from "./composables/useSkillsDrawer.js";
import { usePanelResize, MIN_WIDTH, HANDLE_WIDTH } from "./composables/usePanelResize.js";
import { collectSearchExpandPaths, collectSearchMatches, nextIndex, prevIndex } from "./components/graph/search.js";
import * as clientApi from "./api/client.js";
import { ACTIVE_NODE_FADE_MS } from "./components/graph/canvasRenderer.js";
import { collapseHome, setHome } from "./utils/path.js";

const { t } = useI18n();

const props = defineProps({
  initialTree: Object,
  initialCurrentFile: Object,
  initialSelectedNode: Object,
  contextMenuActions: Object,
});

const api = inject("api", clientApi);
const { tree: treeState, expanded, selectedNode: treeSelectedNode, loadTree, toggleNode, selectNode, expandAll, graftChildren } = useTree(api);

const importModalOpen = ref(false);

function handleImported(event) {
  loadTree(event.destination);
}

// Skills drawer state — overlays, start closed
const drawerOpen = ref(false);
const monitorOpen = ref(false);

// Panel resize
const panesRef = ref(null);
const { leftWidth, isDragging, fullPanel, startDrag, toggleFullPanel, handleResizeKey } = usePanelResize(panesRef);
const STRIP_WIDTH_PX = 32;
const graphPanelStyle = computed(() => {
  if (fullPanel.value === 'graph') return { flex: '1', overflow: 'hidden' };
  if (fullPanel.value === 'editor') return { width: `${STRIP_WIDTH_PX}px`, flex: 'none', overflow: 'hidden' };
  return { width: leftWidth.value + 'px', flex: 'none', overflow: 'hidden' };
});
const editorPanelStyle = computed(() => {
  if (fullPanel.value === 'editor') return { flex: '1', overflow: 'hidden' };
  if (fullPanel.value === 'graph') return { width: `${STRIP_WIDTH_PX}px`, flex: 'none', overflow: 'hidden' };
  return { flex: '1', overflow: 'hidden' };
});
const ariaValueNow = computed(() => {
  if (!panesRef.value) return 50;
  const cw = panesRef.value.offsetWidth;
  return cw > 0 ? Math.round((leftWidth.value / cw) * 100) : 50;
});
const ariaValueMin = computed(() => {
  if (!panesRef.value) return 0;
  const cw = panesRef.value.offsetWidth;
  return cw > 0 ? Math.round((MIN_WIDTH / cw) * 100) : 0;
});
const ariaValueMax = computed(() => {
  if (!panesRef.value) return 100;
  const cw = panesRef.value.offsetWidth;
  return cw > 0 ? Math.round(((cw - MIN_WIDTH - HANDLE_WIDTH) / cw) * 100) : 100;
});

// Dark mode
const isDark = ref(false);
function handleToggleDark() {
  document.documentElement.classList.toggle('dark');
  isDark.value = document.documentElement.classList.contains('dark');
  localStorage.setItem('skills-vis-dark', isDark.value ? '1' : '');
}
const recentFiles = ref([]);
const drawerError = ref(null);
const toolbarRef = ref(null);
const graphPanelRef = ref(null);
const serverWorkspacePath = ref(null);
const { saved, starters, loading: drawerLoading, error: drawerFetchError, fetchSkills, addSkill, updateSkill, removeSkill } = useSkillsDrawer();

onMounted(async () => {
  // Restore dark mode preference
  if (localStorage.getItem('skills-vis-dark')) {
    document.documentElement.classList.add('dark');
    isDark.value = true;
  }

  document.addEventListener('keydown', _handleGlobalKey);

  fetchSkills();
  if (api) {
    try {
      const data = await api.getServerCwd();
      if (data?.home) setHome(data.home);
      if (data?.path) {
        serverWorkspacePath.value = data.path;
        await loadTree(data.path);
        rootInput.value = collapseHome(data.path);
      }
    } catch {
      // silently ignore — user can load manually
    }
    try {
      usageSessions.value = await api.listUsageSessions();
    } catch {
      // silently ignore
    }
  }
});

function handleOpenDrawer() {
  monitorOpen.value = false;
  drawerOpen.value = true;
  fetchSkills();
}

async function handleOpenMonitor() {
  drawerOpen.value = false;
  monitorOpen.value = true;
  try {
    if (api) {
      usageSessions.value = await api.listUsageSessions();
    }
  } catch {
    // silently ignore
  }
}

const computedDrawerError = computed(() => drawerError.value || drawerFetchError.value);

function countSkills(node) {
  if (!node) return 0;
  if (node.type === 'skill') return 1;
  return (node.children || []).reduce((acc, c) => acc + countSkills(c), 0);
}

const skillCount = computed(() => tree.value ? countSkills(tree.value) : 0);

function readableError(err, fallback) {
  return err?.response?.data?.detail || err?.message || fallback;
}

async function handleLoad() {
  if (!rootInput.value) return;
  drawerError.value = null;
  try {
    await loadTree(rootInput.value);
  } catch (err) {
    drawerError.value = readableError(err, "Failed to load");
  }
}

async function handleDrawerSelect(entry) {
  drawerError.value = null;
  try {
    await loadTree(entry.path);
    rootInput.value = collapseHome(entry.path);
  } catch (err) {
    drawerError.value = readableError(err, "Failed to load");
  }
}

async function handleDrawerAdd(payload) { 
  try {
    await addSkill(payload);
    drawerError.value = null; // Clear error on success, which signals form to close
  } catch (err) {
    drawerError.value = readableError(err, "Failed to add skill");
  }
}

async function handleDrawerUpdate(id, payload) {
  try {
    const updated = await updateSkill(id, payload);
    drawerError.value = null;
    await handleDrawerSelect(updated);
  } catch (err) {
    drawerError.value = readableError(err, "Failed to update skill");
  }
}
async function handleDrawerRemove(id) { await removeSkill(id); }
async function handleDrawerAddStarter(starter) {
  await addSkill({ label: starter.name, path: starter.path });
}

// Use initialTree if provided (for testing)
const tree = computed(() => props.initialTree || treeState.value);

// Ensure root node is always expanded
const expandedWithRoot = computed(() => {
  const result = { ...expanded.value };
  if (tree.value && tree.value.path && !(tree.value.path in expanded.value)) {
    result[tree.value.path] = true;
  }
  for (const path of graphSearchExpandPaths.value) {
    if (expanded.value[path] !== false) {
      result[path] = true;
    }
  }
  return result;
});

// Use initialSelectedNode or treeSelectedNode
const selectedNode = computed(() => props.initialSelectedNode || treeSelectedNode.value);

const loadingPaths = ref(new Set());

const isRecording = ref(false);
const isReplaying = ref(false);
const activeSessionId = ref(null);
const activePaths = ref(new Set());
const replaySessionId = ref(null);
const usageSessions = ref([]);
const invokedSkillNames = ref([]);
const replayRootMismatch = ref(null);
const REPLAY_INTERVAL_MS = 1000;
let _eventSource = null;
const _fadeTimers = [];

// Walk tree.value (computed: initialTree || treeState) rather than treeState.value directly.
// This ensures handleToggle works in tests that inject trees via initialTree prop.
function findInTree(path) {
  const root = tree.value;
  if (!root) return null;
  function walk(node) {
    if (node.path === path) return node;
    for (const child of node.children ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
  return walk(root);
}

function resolveSkillPath(skillPath) {
  if (skillPath.startsWith('/')) return skillPath;
  const rootPath = tree.value?.path;
  return rootPath ? `${rootPath}/${skillPath}` : skillPath;
}

async function expandActiveNode(skillPath) {
  const root = tree.value;
  if (!root) return;

  skillPath = resolveSkillPath(skillPath);

  // Derive folder path (strip trailing SKILL.md)
  const folderPath = skillPath.includes('/')
    ? (skillPath.toLowerCase().endsWith('.md') ? skillPath.slice(0, skillPath.lastIndexOf('/')) : skillPath)
    : null;

  if (folderPath && folderPath.startsWith(root.path)) {
    // Walk down from root one segment at a time, fetching children as needed.
    // This handles deeply nested paths where intermediate folders aren't yet loaded.
    const relative = folderPath.slice(root.path.length);
    const segments = relative.split('/').filter(Boolean);
    let currentPath = root.path;
    for (const segment of segments) {
      currentPath = currentPath + '/' + segment;
      const node = findInTree(currentPath);
      if (!node) break; // parent fetch failed or path doesn't exist
      if (node.type === 'folder' && node.children_loaded === false) {
        try { await fetchNodeChildren(currentPath); } catch { return; }
      }
      expanded.value[currentPath] = true;
    }
    return;
  }

  // Fallback: basename match for short names (only searches already-loaded nodes)
  const basename = (folderPath ?? skillPath).split('/').pop().replace(/\.md$/i, '');
  if (!basename) return;
  function walkBasename(node) {
    if ((node.path?.split('/').pop() ?? '') === basename) return node.path;
    for (const child of node.children ?? []) {
      const found = walkBasename(child);
      if (found) return found;
    }
    return null;
  }
  const targetPath = walkBasename(root);
  if (!targetPath) return;
  const targetNode = findInTree(targetPath);
  if (targetNode?.type === 'folder' && targetNode.children_loaded === false) {
    try { await fetchNodeChildren(targetPath); } catch { return; }
  }
  expanded.value[targetPath] = true;
}

async function fetchNodeChildren(path) {
  loadingPaths.value = new Set([...loadingPaths.value, path]);
  try {
    const data = await api.getTree(path, 1, false);
    graftChildren(path, data.children ?? []);
  } finally {
    const next = new Set(loadingPaths.value);
    next.delete(path);
    loadingPaths.value = next;
  }
}

async function handleExpandAll(rootPath) {
  // Recursively ensure every folder under rootPath has its children loaded,
  // then expand the whole subtree in one pass.
  async function ensureLoaded(path) {
    const node = findInTree(path);
    if (!node || node.type !== 'folder') return;
    if (node.children_loaded === false) {
      await fetchNodeChildren(path);
    }
    // Re-find after potential graft so we see the freshly loaded children
    const fresh = findInTree(path);
    for (const child of fresh?.children ?? []) {
      if (child.type === 'folder') await ensureLoaded(child.path);
    }
  }
  await ensureLoaded(rootPath);
  expandAll(rootPath);
}

async function handleToggle(path) {
  const node = findInTree(path);
  if (node && node.type === "folder" && node.children_loaded === false) {
    const isExpanded = expanded.value[path]; // use user-explicit state, not search-augmented
    const isLoading = loadingPaths.value.has(path);
    if (isLoading) return;
    if (!isExpanded) {
      try {
        await fetchNodeChildren(path);
      } catch (err) {
        window.alert(readableError(err, "Failed to load folder contents"));
        return;
      }
    }
  }
  toggleNode(path);
}

async function toggleRecord() {
  if (isRecording.value) {
    _eventSource?.close();
    _eventSource = null;
    if (activeSessionId.value) {
      await api.stopUsageSession(activeSessionId.value);
    }
    activeSessionId.value = null;
    _fadeTimers.forEach(clearTimeout);
    _fadeTimers.length = 0;
    activePaths.value = new Set();
    isRecording.value = false;
    invokedSkillNames.value = [];
    usageSessions.value = await api.listUsageSessions();
  } else {
    const graphRoot = rootInput.value || null;
    const { session_id } = await api.startUsageSession({
      agent: "copilot-cli",
      graph_root: graphRoot,
    });
    activeSessionId.value = session_id;
    isRecording.value = true;
    invokedSkillNames.value = [];
    _eventSource = api.openUsageStream(null, (event) => {
      const raw = event.skill_path;
      const resolved = resolveSkillPath(raw);
      activePaths.value = new Set([...activePaths.value, raw, resolved]);
      invokedSkillNames.value = [event.skill_name, ...invokedSkillNames.value];
      expandActiveNode(raw);
      const timerId = setTimeout(() => {
        activePaths.value = new Set(
          [...activePaths.value].filter((p) => p !== raw && p !== resolved)
        );
        const idx = _fadeTimers.indexOf(timerId);
        if (idx !== -1) _fadeTimers.splice(idx, 1);
      }, ACTIVE_NODE_FADE_MS);
      _fadeTimers.push(timerId);
    });
  }
}

function handleSelectSkillFromSession(skillPath) {
  const resolved = resolveSkillPath(skillPath);
  activePaths.value = new Set([skillPath, resolved]);
  const node = findInTree(skillPath) ?? findInTree(resolved);
  if (node) selectNode(node);
}

async function handleDeleteSession(sessionId) {
  await api.deleteUsageSession(sessionId);
  usageSessions.value = usageSessions.value.filter((s) => s.id !== sessionId);
}

async function handleReplaySession(sessionId) {
  if (isRecording.value || isReplaying.value) return;
  isReplaying.value = true;
  replaySessionId.value = sessionId;
  expanded.value = {}; // collapse all graph nodes before replay
  try {
    const events = await api.getSessionEvents(sessionId);

    const session = usageSessions.value.find((s) => s.id === sessionId);
    if (session?.graph_root && session.graph_root !== rootInput.value) {
      replayRootMismatch.value = session.graph_root;
    } else {
      replayRootMismatch.value = null;
    }

    for (const event of events) {
      const raw = event.skill_path;
      const resolved = resolveSkillPath(raw);
      activePaths.value = new Set([...activePaths.value, raw, resolved]);
      await expandActiveNode(raw);
      await new Promise((r) => setTimeout(r, REPLAY_INTERVAL_MS));
      activePaths.value = new Set(
        [...activePaths.value].filter((p) => p !== raw && p !== resolved)
      );
    }
  } finally {
    replayRootMismatch.value = null;
    isReplaying.value = false;
    replaySessionId.value = null;
  }
}

const currentFile = ref(props.initialCurrentFile || null);
const rootInput = ref("");
const graphTransform = ref({ x: 40, y: 40, scale: 1 });
const graphReorderByMtime = ref(false);
const graphSearchQuery = ref("");
const graphSearchMatches = ref([]);
const graphSearchActiveIndex = ref(-1);
const graphSearchExpandPaths = ref([]);

const fileOps = useFileOps(api || {}, {
  rootPath: computed(() => tree.value?.path || ""),
  reloadTree: (path) => {
    if (api && loadTree) loadTree(path);
  },
  selectedNode: computed(() => selectedNode.value),
  currentFile,
});

// Override fileOps with test actions if provided
const finalFileOps = computed(() => {
  if (!props.contextMenuActions) return fileOps;
  return {
    ...fileOps,
    ...props.contextMenuActions,
  };
});

const ui = useWorkspaceUi();

// Plain variables (not reactive) — listeners don't need to trigger re-renders
let _outsideClickListener = null
let _escapeListener = null

function _removeContextMenuListeners() {
  if (_outsideClickListener) {
    document.removeEventListener('pointerdown', _outsideClickListener, { capture: true })
    document.removeEventListener('click', _outsideClickListener, { capture: true })
    document.removeEventListener('mousedown', _outsideClickListener, { capture: true })
    _outsideClickListener = null
  }
  if (_escapeListener) {
    document.removeEventListener('keydown', _escapeListener)
    _escapeListener = null
  }
}

function hideContextMenu() {
  ui.hideContextMenu()
  _removeContextMenuListeners()
}

function _handleGlobalKey(e) {
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    graphPanelRef.value?.focusSearch?.();
  }
  // ⌘⇧R (Cmd+Shift+R) toggles recording
  if (e.key === 'R' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
    e.preventDefault();
    toggleRecord();
  }
}

onUnmounted(() => {
  _removeContextMenuListeners();
  document.removeEventListener('keydown', _handleGlobalKey);
  _eventSource?.close();
  _fadeTimers.forEach(clearTimeout);
})

const contextMenuVisible = computed(() => ui.contextMenuVisible.value);
const contextMenuNode = computed(() => ui.contextMenuNode.value);
const contextMenuX = computed(() => ui.contextMenuX.value);
const contextMenuY = computed(() => ui.contextMenuY.value);

const contextMenuIsExpanded = computed(
  () => !!expandedWithRoot.value[contextMenuNode.value?.path]
);
const activeSearchPath = computed(() => graphSearchMatches.value[graphSearchActiveIndex.value] ?? null);

const editorActions = computed(() => ({
  saveSelectedFile: finalFileOps.value.saveSelectedFile,
  renameNode: finalFileOps.value.renameNode,
  deleteNode: finalFileOps.value.deleteNode,
}));

const contextMenuActions = computed(() => ({
  renameNode: finalFileOps.value.renameNode,
  deleteNode: finalFileOps.value.deleteNode,
  copyPath: finalFileOps.value.copyPath || (async (path) => {
    await navigator.clipboard.writeText(path);
  }),
  createFileAtNode: finalFileOps.value.createFileAtNode,
  createFolderAtNode: finalFileOps.value.createFolderAtNode,
  toggleExpand: handleToggle,
  expandAll: handleExpandAll,
  setAsRoot: async (node) => {
    await loadTree(node.path);
    rootInput.value = collapseHome(node.path);
  },
  saveToMySkills: async (node) => {
    try {
      await api?.createSkill({ label: node.name, path: node.path });
      fetchSkills();
    } catch (err) {
      window.alert(readableError(err, "Failed to save to My Skills."));
    }
  },
}));

async function handleContextMenu(data) {
  _removeContextMenuListeners()
  ui.showContextMenu(data.node, data.x, data.y);

  const isInsideContextMenu = (event) => {
    const menuEl = document.querySelector('.context-menu')
    if (!menuEl) return false
    const path = typeof event.composedPath === 'function' ? event.composedPath() : null
    return Array.isArray(path) ? path.includes(menuEl) : menuEl.contains(event.target)
  }

  // close if interaction target is outside the context menu element
  _outsideClickListener = (e) => {
    if (!isInsideContextMenu(e)) {
      hideContextMenu()
    }
  }

  // keydown: close on Escape
  _escapeListener = (e) => {
    if (e.key === 'Escape') {
      hideContextMenu()
    }
  }

  // Attach on next tick so the DOM has rendered the menu element before
  // the outside-click handler needs to query it via querySelector
  await nextTick()
  document.addEventListener('pointerdown', _outsideClickListener, { capture: true })
  document.addEventListener('click', _outsideClickListener, { capture: true })
  document.addEventListener('mousedown', _outsideClickListener, { capture: true })
  document.addEventListener('keydown', _escapeListener)
}

function handleTransformUpdate(nextTransform) {
  graphTransform.value = nextTransform;
}

function handleReorderByMtimeUpdate(nextValue) {
  graphReorderByMtime.value = !!nextValue;
}

function recomputeGraphSearchMatches() {
  const previousActivePath = activeSearchPath.value;
  const matches = collectSearchMatches(tree.value, graphSearchQuery.value);
  graphSearchMatches.value = matches;
  graphSearchExpandPaths.value = collectSearchExpandPaths(tree.value, matches);
  if (!matches.length) {
    graphSearchActiveIndex.value = -1;
    return;
  }
  const preservedIndex = previousActivePath ? matches.indexOf(previousActivePath) : -1;
  graphSearchActiveIndex.value = preservedIndex >= 0 ? preservedIndex : 0;
}

function handleSearchQueryUpdate(nextQuery) {
  graphSearchQuery.value = String(nextQuery ?? "");
}

function handleNextSearchMatch() {
  const next = nextIndex(graphSearchActiveIndex.value, graphSearchMatches.value.length);
  if (next >= 0) {
    graphSearchActiveIndex.value = next;
  }
}

function handlePrevSearchMatch() {
  const prev = prevIndex(graphSearchActiveIndex.value, graphSearchMatches.value.length);
  if (prev >= 0) {
    graphSearchActiveIndex.value = prev;
  }
}

// When initial props change, update selected node
watch(() => props.initialSelectedNode, (newNode) => {
  if (newNode && currentFile.value === null) {
    if (newNode.type === "file") {
      // Automatically open the file
      fileOps.openFile(newNode.path);
    }
  }
});

watch(() => props.initialCurrentFile, (newFile) => {
  if (newFile) {
    currentFile.value = newFile;
  }
});

// Watch for selectedNode changes (from graph clicks) and auto-open files
watch(selectedNode, async (node) => {
  if (!node || node.type !== "file") {
    currentFile.value = null;
    return;
  }
  await fileOps.openFile(node.path);
  // Track recently opened
  const entry = { name: node.name, parent: node.path.split('/').slice(-2, -1)[0] || '', path: node.path };
  recentFiles.value = [entry, ...recentFiles.value.filter(f => f.path !== node.path)].slice(0, 6);
});

watch(
  () => tree.value?.path,
  (next, prev) => {
    if (!next) return;
    if (prev && next !== prev) {
      graphTransform.value = { x: 40, y: 40, scale: 1 };
    }
  },
);

watch([tree, graphSearchQuery], () => {
  recomputeGraphSearchMatches();
}, { deep: true, immediate: true });
</script>
