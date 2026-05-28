<template>
  <div class="toolbar">
    <!-- Brand -->
    <div class="brand">
      <img src="/skills_vis.png" height="40" alt="Skills-vis" style="width:auto;display:block;" />
    </div>

    <!-- Path input -->
    <div class="path-input">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted); flex-shrink: 0;" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
      </svg>
      <input
        :value="modelValue"
        class="mono"
        placeholder="~/.claude/skills"
        data-test="path-display"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown.enter="$emit('load')"
      />
      <div v-if="skillCount" class="path-badge">
        <span>{{ skillCount }}</span>
        <span>skills</span>
      </div>
    </div>

    <button class="tb-btn" @click="$emit('load')">Load</button>
    <button class="tb-btn" data-test="open-import" @click="$emit('open-import')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted);" aria-hidden="true">
        <circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/>
        <path d="M11 6h4a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h4"/>
      </svg>
      Browse…
    </button>

    <div class="toolbar-spacer" />

    <!-- Dark mode toggle -->
    <button class="tb-icon" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" data-test="toggle-dark" @click="$emit('toggle-dark')">
      <!-- Moon (show in light mode → click to go dark) -->
      <svg v-if="!isDark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <!-- Sun (show in dark mode → click to go light) -->
      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    </button>

    <button class="tb-btn" @click="$emit('open-drawer')" data-test="open-drawer">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted);" aria-hidden="true">
        <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>
      </svg>
      Skills
    </button>

    <button class="tb-btn" @click="$emit('open-monitor')" data-test="open-monitor">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted);" aria-hidden="true">
        <path d="M3 12h4l3-8 4 16 3-8h4"/>
      </svg>
      Sessions
    </button>

    <!-- Record button -->
    <button
      v-if="isRecording"
      class="tb-btn rec"
      data-test="record-btn"
      @click="$emit('toggle-record')"
    >
      <span class="rec-dot" />
      Recording
    </button>
    <button
      v-else
      class="tb-btn primary"
      data-test="record-btn"
      @click="$emit('toggle-record')"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
        <circle cx="12" cy="12" r="6"/>
      </svg>
      Record
    </button>

    <!-- Hidden file input for browse -->
    <input
      ref="fileInput"
      type="file"
      webkitdirectory
      data-test="folder-picker"
      style="display: none"
      @change="onFiles"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  isRecording: { type: Boolean, default: false },
  isDark: { type: Boolean, default: false },
  skillCount: { type: Number, default: 0 },
});

const emit = defineEmits([
  "update:modelValue", "load", "browse", "open-drawer", "open-import",
  "show-hint", "toggle-record", "open-monitor", "toggle-dark",
]);

const fileInput = ref(null);

function openPicker() {
  fileInput.value?.click();
}

function onFiles(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const first = files[0];
  if (first.path) {
    const relativeSuffix = first.webkitRelativePath.substring(first.webkitRelativePath.indexOf("/"));
    const abs = first.path.slice(0, first.path.length - relativeSuffix.length);
    emit("update:modelValue", abs);
    emit("browse", abs);
  } else {
    emit("show-hint");
  }
}

defineExpose({ triggerPicker: openPicker });
</script>
