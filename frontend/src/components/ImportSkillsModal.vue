<template>
  <div v-if="open" class="modal-overlay" data-test="import-modal">
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">Import Skills</span>
        <button class="modal-close" data-test="modal-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Step 1: Source input -->
      <div v-if="step === 1" class="modal-body">
        <div class="source-toggle">
          <button
            :class="['toggle-btn', sourceType === 'repo' ? 'active' : '']"
            data-test="source-repo"
            @click="sourceType = 'repo'"
          >GitHub / GitLab</button>
          <button
            :class="['toggle-btn', sourceType === 'local' ? 'active' : '']"
            data-test="source-local"
            @click="sourceType = 'local'"
          >Local folder</button>
        </div>

        <div v-if="sourceType === 'repo'" class="field-group">
          <label class="field-label">Repository URL</label>
          <input
            v-model="repoUrl"
            class="field-input"
            data-test="repo-url-input"
            placeholder="https://github.com/org/repo"
          />
          <label class="field-label">Subfolder (optional)</label>
          <input
            v-model="subfolder"
            class="field-input"
            data-test="subfolder-input"
            placeholder="e.g. skills/"
          />
        </div>

        <div v-else class="field-group">
          <label class="field-label">Local path</label>
          <div v-if="savedPaths.length > 0">
            <label class="field-label">Saved locations</label>
            <select
              class="field-input saved-paths-select"
              data-test="saved-paths-select"
              @change="localPath = $event.target.value"
            >
              <option value="">— pick a saved location —</option>
              <option v-for="p in savedPaths" :key="p.id" :value="p.path">{{ p.label }} — {{ p.path }}</option>
            </select>
          </div>
          <div class="path-row">
            <input
              v-model="localPath"
              class="field-input"
              data-test="local-path-input"
              placeholder="/absolute/path/to/skills"
            />
            <button
              v-if="isElectron"
              class="btn-secondary"
              data-test="browse-btn"
              type="button"
              @click="triggerPicker"
            >Browse…</button>
          </div>
          <input
            ref="pickerRef"
            type="file"
            webkitdirectory
            style="display: none"
            @change="onPickerChange"
          />
        </div>

        <p v-if="scanError" class="error-text" data-test="scan-error">{{ scanError }}</p>

        <div class="modal-footer">
          <button
            class="btn-primary"
            data-test="scan-btn"
            :disabled="scanning || !canScan"
            @click="handleScan"
          >{{ scanning ? 'Scanning…' : 'Scan' }}</button>
        </div>
      </div>

      <!-- Step 2: Skill list -->
      <div v-if="step === 2" class="modal-body" data-test="step-2">
        <!-- Conflict sub-dialog overlay -->
        <div v-if="conflictQueue.length > 0" class="conflict-overlay" data-test="conflict-dialog">
          <div class="conflict-box">
            <p class="conflict-message">
              <strong data-test="conflict-name">{{ conflictQueue[0] }}</strong> already exists at the destination.
            </p>
            <div class="conflict-actions">
              <button class="btn-secondary" data-test="conflict-cancel-btn" @click="cancelConflict">Cancel</button>
              <button class="btn-secondary" data-test="conflict-skip" @click="resolveConflict(conflictQueue[0], 'skip')">Skip</button>
              <button class="btn-primary" data-test="conflict-overwrite-btn" @click="resolveConflict(conflictQueue[0], 'overwrite')">Overwrite</button>
            </div>
          </div>
        </div>

        <div class="source-badge" data-test="source-badge">{{ sourceLabel }} — {{ skillList.length }} skills found</div>

        <div class="list-controls">
          <a href="#" data-test="select-all-btn" @click.prevent="selectAll">Select all</a>
          <span class="list-sep">·</span>
          <a href="#" data-test="select-none" @click.prevent="selectNone">Unselect all</a>
        </div>

        <input
          v-model="searchQuery"
          class="field-input search-input"
          data-test="skill-search"
          placeholder="Search skills…"
          type="search"
        />

        <div class="skill-list">
          <label
            v-for="skill in filteredSkills"
            :key="skill.name"
            data-test="skill-item"
            class="skill-row"
          >
            <input type="checkbox" data-test="skill-checkbox" :checked="selected.has(skill.name)" @change="toggleSkill(skill.name)" />
            <div class="skill-info">
              <span class="skill-name">{{ skill.name }}</span>
              <span class="skill-desc">{{ skill.description }}</span>
            </div>
          </label>
        </div>

        <p v-if="importError" class="error-text" data-test="error-banner">
          {{ importError }}
          <button v-if="showRetry" class="btn-link" data-test="retry-btn" @click="goBack">Try Again</button>
        </p>

        <div class="modal-footer">
          <span class="selection-count" data-test="selection-count">{{ selected.size }} of {{ skillList.length }} selected</span>
          <button class="btn-secondary" data-test="back-btn" @click="goBack">Back</button>
          <button class="btn-primary" data-test="import-btn" :disabled="importing || selected.size === 0" @click="handleImport">
            {{ importing ? 'Importing…' : `Import ${selected.size} skill${selected.size !== 1 ? 's' : ''}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from "vue";
import { scanSkills, importSkills } from "../api/skills_import.js";

const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(["close", "imported"]);

const step = ref(1);
const sourceType = ref("repo");
const repoUrl = ref("");
const subfolder = ref("skills");
const localPath = ref("");
const scanning = ref(false);
const scanError = ref(null);
const skillList = ref([]);
const sourceLabel = ref("");
const selected = ref(new Set());
const importing = ref(false);
const importError = ref(null);
const showRetry = ref(false);
const conflictQueue = ref([]);
const conflictResolutions = ref({});
const searchQuery = ref("");

const filteredSkills = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return skillList.value;
  return skillList.value.filter(
    s => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
  );
});
const pickerRef = ref(null);

const api = inject("api", null);
const savedPaths = ref([]);

async function loadSavedPaths() {
  try {
    const data = await api?.getSkills();
    if (data?.saved) {
      savedPaths.value = data.saved.filter(p => p.is_available === true);
    }
  } catch {
    savedPaths.value = [];
  }
}

onMounted(() => {
  if (props.open) loadSavedPaths();
});

watch(() => props.open, (val) => {
  if (val) {
    loadSavedPaths();
  } else {
    savedPaths.value = [];
  }
});

const isElectron = computed(() => typeof window !== "undefined" && !!window.electron);
const canScan = computed(() =>
  sourceType.value === "repo" ? !!repoUrl.value.trim() : !!localPath.value.trim()
);

function detectRepoSource(url) {
  try { return new URL(url).hostname.includes("gitlab.com") ? "gitlab" : "github"; }
  catch { return "github"; }
}

function triggerPicker() {
  pickerRef.value?.click();
}

function onPickerChange(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const first = files[0];
  if (!first.path) return;
  const rel = first.webkitRelativePath;
  const slashIdx = rel.indexOf("/");
  if (slashIdx === -1) {
    localPath.value = first.path.substring(0, first.path.lastIndexOf("/"));
  } else {
    const suffix = rel.substring(slashIdx);
    localPath.value = first.path.slice(0, first.path.length - suffix.length);
  }
}

function buildSourcePayload() {
  if (sourceType.value === "repo") {
    return {
      source: detectRepoSource(repoUrl.value),
      url: repoUrl.value.trim(),
      subfolder: subfolder.value.trim() || undefined,
    };
  }
  return { source: "local", path: localPath.value.trim() };
}

async function handleScan() {
  scanError.value = null;
  scanning.value = true;
  try {
    const data = await scanSkills(buildSourcePayload());
    if (data.skills.length === 0) {
      scanError.value = "No skills found in this source.";
      return;
    }
    skillList.value = data.skills;
    sourceLabel.value = data.source_label;
    selected.value = new Set(data.skills.map(s => s.name));
    conflictResolutions.value = {};
    conflictQueue.value = [];
    importError.value = null;
    step.value = 2;
  } catch (err) {
    scanError.value = err.detail || "Failed to scan source";
  } finally {
    scanning.value = false;
  }
}

function goBack() {
  step.value = 1;
  skillList.value = [];
  selected.value = new Set();
  conflictResolutions.value = {};
  conflictQueue.value = [];
  importError.value = null;
  searchQuery.value = "";
}

function selectAll() { selected.value = new Set(skillList.value.map(s => s.name)); }
function selectNone() { selected.value = new Set(); }
function toggleSkill(name) {
  const next = new Set(selected.value);
  next.has(name) ? next.delete(name) : next.add(name);
  selected.value = next;
}

async function handleImport() {
  importError.value = null;
  showRetry.value = false;
  importing.value = true;
  const payload = {
    ...buildSourcePayload(),
    skill_names: [...selected.value],
    conflict_resolution: { ...conflictResolutions.value },
  };
  try {
    const result = await importSkills(payload);
    emit("imported", { destination: result.destination, imported: result.imported, skipped: result.skipped });
    emit("close");
  } catch (err) {
    if (err.conflicts) {
      conflictQueue.value = err.conflicts;
    } else if (err.status === 422) {
      importError.value = "One or more selected skills could not be found — please re-scan and try again";
      showRetry.value = false;
    } else {
      importError.value = "Import failed — go back and try again. Some skills may have been partially copied.";
      showRetry.value = true;
    }
  } finally {
    if (conflictQueue.value.length === 0) {
      importing.value = false;
    }
  }
}

async function resolveConflict(name, resolution) {
  conflictResolutions.value = { ...conflictResolutions.value, [name]: resolution };
  conflictQueue.value = conflictQueue.value.slice(1);
  if (conflictQueue.value.length === 0) {
    await handleImport();
  }
}

function cancelConflict() {
  conflictQueue.value = [];
  conflictResolutions.value = {};
  importing.value = false;
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-box {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 560px;
  max-width: 95vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
  color: var(--text);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.modal-title { font-weight: 600; font-size: 14px; letter-spacing: -0.01em; }
.modal-close {
  background: none; border: none; cursor: pointer; font-size: 15px;
  color: var(--muted); padding: 3px 7px; border-radius: var(--radius-sm);
  line-height: 1;
}
.modal-close:hover { background: var(--sub); color: var(--text); }
.modal-body { padding: 20px; flex: 1; overflow-y: auto; position: relative; }
.source-toggle { display: flex; gap: 6px; margin-bottom: 18px; }
.toggle-btn {
  padding: 6px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--sub);
  cursor: pointer; font-size: 12.5px; color: var(--text-2);
  font-family: inherit;
}
.toggle-btn:hover { background: var(--border); }
.toggle-btn.active {
  background: var(--text); color: var(--bg);
  border-color: var(--text);
}
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 11.5px; font-weight: 500; color: var(--muted); margin-top: 10px; }
.path-row { display: flex; gap: 8px; align-items: center; }
.path-row .field-input { flex: 1; min-width: 0; }
.field-input {
  padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 12.5px; font-family: "Geist Mono", ui-monospace, monospace;
  background: var(--bg); color: var(--text); outline: none;
}
.field-input:focus { border-color: var(--accent); }
.error-text { color: var(--rec); font-size: 12.5px; margin-top: 8px; }
.modal-footer {
  display: flex; justify-content: flex-end; align-items: center;
  padding: 12px 20px; border-top: 1px solid var(--border); gap: 8px;
  flex-shrink: 0;
}
.btn-primary {
  padding: 7px 16px; background: var(--text); color: var(--bg); border: none;
  border-radius: var(--radius-sm); font-size: 12.5px; font-weight: 500;
  cursor: pointer; font-family: inherit;
}
.btn-primary:hover { background: color-mix(in oklab, var(--text), #888 15%); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-secondary {
  padding: 7px 16px; background: var(--sub); color: var(--text-2);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 12.5px; cursor: pointer; font-family: inherit;
}
.btn-secondary:hover { background: var(--border); }
.source-badge {
  font-size: 11.5px; color: var(--muted); background: var(--sub);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 5px 10px; margin-bottom: 14px;
  font-family: "Geist Mono", monospace;
}
.list-controls { display: flex; gap: 8px; font-size: 12.5px; margin-bottom: 10px; align-items: center; }
.list-controls a { color: var(--accent-ink); text-decoration: underline; cursor: pointer; font-weight: 500; }
html.dark .list-controls a { color: var(--accent); }
.list-sep { color: var(--border-2); }
.skill-list {
  overflow-y: auto; max-height: 320px;
  display: flex; flex-direction: column;
  border: 1px solid var(--border); border-radius: var(--radius);
}
.skill-row {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 11px 12px; cursor: pointer;
  border-bottom: 1px solid var(--border);
  height: auto; /* override global .skill-row { height: var(--row-h) } */
  border-radius: 0; width: auto; border-left: none; border-right: none; border-top: none;
}
.skill-row:last-child { border-bottom: none; }
.skill-row:hover { background: var(--sub); }
.skill-row input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; accent-color: var(--accent); }
.skill-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow: hidden; }
.skill-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.skill-desc { font-size: 12px; color: var(--muted); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.selection-count { flex: 1; font-size: 12.5px; color: var(--muted); align-self: center; }
.btn-link { background: none; border: none; color: var(--accent-ink); text-decoration: underline; cursor: pointer; font-size: 12.5px; margin-left: 6px; font-family: inherit; }
html.dark .btn-link { color: var(--accent); }
.conflict-overlay {
  position: absolute; inset: 0;
  background: color-mix(in oklab, var(--panel), transparent 12%);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-lg); z-index: 10;
}
.conflict-box {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 24px; width: 340px;
  box-shadow: var(--shadow-md);
}
.conflict-message { font-size: 13.5px; margin-bottom: 16px; color: var(--text); }
.conflict-actions { display: flex; justify-content: flex-end; gap: 8px; }
.search-input { margin-bottom: 10px; width: 100%; box-sizing: border-box; }
.saved-paths-select { width: 100%; box-sizing: border-box; margin-bottom: 4px; }
</style>
