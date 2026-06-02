<template>
  <aside class="drawer-aside left" data-test="skills-drawer">

    <!-- Header -->
    <div class="drawer-hd">
      <h3>Skills Folders</h3>
      <div style="display: flex; gap: 4px;">
        <button class="drawer-hd-icon" title="Add workspace" @click="showAddForm = !showAddForm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
        </button>
        <button class="drawer-hd-icon" title="Close" data-test="drawer-close" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="drawer-body">
      <div v-if="loading" class="drawer-loading" data-test="drawer-loading">Loading…</div>

      <div v-if="error" class="drawer-error" data-test="drawer-error">
        <span>{{ error }}</span>
        <button data-test="drawer-retry" @click="$emit('retry')">Retry</button>
      </div>

      <!-- Workspaces (also labelled "Your skills" for backward compat) -->
      <div class="drawer-section-label">
        <span>Workspaces</span>
        <span class="count">{{ saved.length }}</span>
      </div>
      <span style="display:none">Your skills</span>

      <!-- Server launch directory — always shown, non-dismissible -->
      <div
        v-if="serverRootPath && !saved.find(s => s.path === serverRootPath)"
        class="skill-row unsaved-row"
        :class="{ 'is-active': activeRootPath === serverRootPath }"
        data-test="server-root-btn"
        @click="$emit('select', { path: serverRootPath })"
      >
        <span class="icn">
          <svg v-if="activeRootPath === serverRootPath" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z"/>
            <path d="M3 8h18l-2 9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
        </span>
        <span class="label mono unsaved-path">{{ collapseHome(serverRootPath) }}</span>
      </div>

      <!-- Unsaved (ad-hoc) paths — accumulated locally, not in DB -->
      <div
        v-for="path in extraPaths"
        :key="path"
        class="skill-row unsaved-row"
        :class="{ 'is-active': activeRootPath === path }"
        :data-test="path === activeRootPath ? 'current-workspace-btn' : undefined"
        @click="$emit('select', { path })"
      >
        <span class="icn">
          <svg v-if="activeRootPath === path" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z"/>
            <path d="M3 8h18l-2 9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
        </span>
        <span class="label mono unsaved-path">{{ collapseHome(path) }}</span>
        <button class="se-btn" title="Dismiss" @click.stop="removeExtraPath(path)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div v-for="entry in saved" :key="entry.id">
        <div v-if="editingEntry && editingEntry.id === entry.id">
          <div class="entry-form">
            <input
              v-model="editLabel"
              placeholder="Label (optional)"
              data-test="skill-label-input"
            />
            <input
              v-model="editPath"
              placeholder="Absolute path…"
              data-test="skill-path-input"
            />
            <div class="entry-form-row">
              <button class="entry-form-submit" data-test="skill-form-submit" @click="handleEditSubmit">Save</button>
              <button class="entry-form-cancel" data-test="skill-form-cancel" @click="cancelEdit">Cancel</button>
            </div>
          </div>
        </div>
        <div
          v-else-if="entry.is_available"
          class="skill-row"
          :class="{ 'is-active': activeRootPath === entry.path }"
          :data-test="`select-skill-${entry.id}`"
          @click="$emit('select', entry)"
        >
          <span class="icn">
            <svg v-if="activeRootPath === entry.path" width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z"/>
              <path d="M3 8h18l-2 9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
            </svg>
          </span>
          <span class="label">{{ entry.label || collapseHome(entry.path) }}</span>
          <span class="meta">{{ entry.skill_count ?? '' }}</span>
          <span class="se-actions" style="display: flex; gap: 2px;">
            <button class="se-btn" title="Edit" :data-test="`edit-skill-${entry.id}`" @click.stop="startEdit(entry)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="se-btn danger" title="Remove" :data-test="`remove-skill-${entry.id}`" @click.stop="$emit('remove', entry.id)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </span>
        </div>
        <!-- Unavailable entry (show but not clickable) -->
        <div
          v-else
          class="skill-row"
          style="opacity: 0.5; cursor: not-allowed;"
          :title="`Path not found: ${collapseHome(entry.path)}`"
        >
          <span class="icn">⚠</span>
          <span class="label">{{ entry.label || collapseHome(entry.path) }}</span>
          <button class="se-btn danger" title="Remove" :data-test="`remove-skill-${entry.id}`" @click.stop="$emit('remove', entry.id)">✕</button>
        </div>
      </div>

      <!-- Add form -->
      <div v-if="showAddForm" class="entry-form" data-test="skill-entry-form">
        <input v-model="addLabel" placeholder="Label (optional)" data-test="skill-label-input" />
        <input v-model="addPath" placeholder="Absolute path…" data-test="skill-path-input" required />
        <div class="entry-form-row">
          <button class="entry-form-submit" data-test="skill-form-submit" @click="handleAddSubmit">Add</button>
          <button class="entry-form-cancel" data-test="skill-form-cancel" @click="showAddForm = false; addLabel = ''; addPath = ''">Cancel</button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="drawer-section-label" style="margin-top: 8px;">
        <span>Quick Actions</span>
      </div>

      <button class="skill-row" @click="showAddForm = true">
        <span class="icn" style="color: var(--muted);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
        </span>
        <span class="label">New skill folder</span>
      </button>

      <button class="skill-row" data-test="drawer-add-manual" @click="showAddForm = true">
        <span class="icn" style="color: var(--muted);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 3h12v18l-6-4-6 4V3z"/>
          </svg>
        </span>
        <span class="label">Save current root</span>
      </button>

      <!-- Starter Library (collapsible, at bottom) -->
      <button class="drawer-section-label starter-toggle" data-test="starter-toggle" style="margin-top: 8px;" @click="starterOpen = !starterOpen">
        <span>Starter Library</span>
        <svg class="starter-chevron" :class="{ open: starterOpen }" width="12" height="12" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <span style="display:none">Popular starters</span>

      <Transition name="starter-expand">
        <div v-if="starterOpen" class="starter-list">
          <template v-for="starter in starters" :key="starter.key">
          <button
            v-if="starter.is_available !== false"
            class="starter-card"
            :data-test="`add-starter-${starter.key}`"
            :disabled="starter.already_added || undefined"
            @click="!starter.already_added && $emit('add-starter', starter)"
          >
            <div class="ix">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3l9 5-9 5-9-5 9-5z"/>
                <path d="m3 13 9 5 9-5"/>
                <path d="m3 17 9 5 9-5"/>
              </svg>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div class="nm">{{ starter.name }}</div>
              <div class="ds">{{ starter.desc || starter.description || collapseHome(starter.path) }}</div>
              <div class="add">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                Add to workspace
              </div>
            </div>
          </button>
          </template>
        </div>
      </Transition>

      <input
        ref="pickerRef"
        type="file"
        webkitdirectory
        data-test="drawer-picker"
        style="display: none"
        @change="onPickerChange"
      />
    </div>
  </aside>
</template>


<script setup>
import { ref, watch } from "vue";
import { collapseHome } from "../utils/path.js";

const props = defineProps({
  open: { type: Boolean, required: true },
  saved: { type: Array, default: () => [] },
  starters: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: [String, null], default: null },
  activeRootPath: { type: String, default: null },
  serverRootPath: { type: String, default: null },
});

const emit = defineEmits(["select", "add", "update", "remove", "add-starter", "retry", "close"]);

// Paths loaded ad-hoc (not in DB) — accumulated so they persist across workspace switches
const extraPaths = ref([]);

watch(
  () => props.activeRootPath,
  (path) => {
    if (!path) return;
    if (path === props.serverRootPath) return; // has its own permanent row
    if (props.saved.find(s => s.path === path)) return;
    if (extraPaths.value.includes(path)) return;
    extraPaths.value.push(path);
  },
  { immediate: true },
);

// Remove from extras once the path is saved to DB
watch(
  () => props.saved,
  (savedList) => {
    extraPaths.value = extraPaths.value.filter(p => !savedList.find(s => s.path === p));
  },
  { deep: true },
);

function removeExtraPath(path) {
  extraPaths.value = extraPaths.value.filter(p => p !== path);
}

const starterOpen = ref(false);

const editingEntry = ref(null);
const editLabel = ref("");
const editPath = ref("");
const showAddForm = ref(false);
const addLabel = ref("");
const addPath = ref("");

const pickerRef = ref(null);
const pickedPath = ref("");

function startEdit(entry) {
  editingEntry.value = entry;
  editLabel.value = entry.label || "";
  editPath.value = entry.path;
  showAddForm.value = false;
}

function cancelEdit() {
  editingEntry.value = null;
  editLabel.value = "";
  editPath.value = "";
}

function handleAddSubmit() {
  if (!addPath.value.trim()) return;
  const label = addLabel.value.trim() || null;
  const path = addPath.value.trim();
  showAddForm.value = false;
  addLabel.value = "";
  addPath.value = "";
  emit("add", { label, path });
}

function handleEditSubmit() {
  if (!editPath.value.trim() || !editingEntry.value) return;
  const id = editingEntry.value.id;
  const label = editLabel.value.trim() || null;
  const path = editPath.value.trim();
  editingEntry.value = null;
  editLabel.value = "";
  editPath.value = "";
  emit("update", id, { label, path });
}

function onPickerChange(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const first = files[0];
  if (!first.path) return;
  const rel = first.webkitRelativePath;
  const slashIdx = rel.indexOf("/");
  if (slashIdx === -1) {
    pickedPath.value = first.path.substring(0, first.path.lastIndexOf("/"));
  } else {
    const suffix = rel.substring(slashIdx);
    pickedPath.value = first.path.slice(0, first.path.length - suffix.length);
  }
  if (pickerRef.value) pickerRef.value.value = "";
}

// Close forms when operation succeeds (error cleared)
let previousError = props.error;
watch(() => props.error, (newError) => {
  if (previousError !== null && newError === null) {
    editingEntry.value = null;
    showAddForm.value = false;
    addLabel.value = "";
    addPath.value = "";
    pickedPath.value = "";
  }
  previousError = newError;
});

defineExpose({ pickedPath });
</script>
