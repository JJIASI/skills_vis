<template>
  <form class="skill-entry-form" data-test="skill-entry-form" @submit.prevent="handleSubmit">
    <div class="skill-entry-top">
      <input
        v-model="localLabel"
        data-test="skill-label-input"
        type="text"
        class="skill-entry-input skill-entry-input--label"
        placeholder="Label (optional)"
      />
      <input
        v-model="localPath"
        data-test="skill-path-input"
        type="text"
        class="skill-entry-input skill-entry-input--path"
        placeholder="Absolute path…"
        required
      />
      <button
        type="button"
        data-test="skill-form-browse"
        class="entry-icon-btn entry-icon-btn--browse"
        title="Browse for folder"
        @click="$emit('browse')"
      >
        <!-- Lucide folder icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <polyline points="2 10 22 10"/>
        </svg>
      </button>
    </div>
    <div class="skill-entry-actions">
      <button
        type="button"
        data-test="skill-form-submit"
        class="entry-icon-btn entry-icon-btn--confirm"
        :title="submitLabel"
        @click="handleSubmit"
      >
        <!-- Lucide Check -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <button
        type="button"
        data-test="skill-form-cancel"
        class="entry-icon-btn entry-icon-btn--cancel"
        title="Cancel"
        @click="$emit('cancel')"
      >
        <!-- Lucide X -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  initialLabel: { type: String, default: "" },
  initialPath: { type: String, default: "" },
  submitLabel: { type: String, default: "Add" },
  browsedPath: { type: String, default: "" },
});
const emit = defineEmits(["submit", "cancel", "browse"]);

const localLabel = ref(props.initialLabel);
const localPath = ref(props.initialPath);

watch(() => props.initialLabel, (v) => { localLabel.value = v; });
watch(() => props.initialPath, (v) => { localPath.value = v; });
watch(() => props.browsedPath, (v) => { if (v) localPath.value = v; });

function handleSubmit() {
  if (!localPath.value.trim()) return;
  emit("submit", { label: localLabel.value.trim() || null, path: localPath.value.trim() });
}
</script>

<style scoped>
.skill-entry-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 16px 12px;
  background: #f8f8f8;
  border-bottom: 1px solid #f0f0f0;
}

.skill-entry-top {
  display: flex;
  gap: 6px;
}

.skill-entry-input {
  padding: 6px 10px;
  border: 1px solid #d8d8d8;
  border-radius: 6px;
  font-size: 12px;
  color: #333;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.skill-entry-input:focus {
  border-color: #999;
}

.skill-entry-input--label {
  width: 110px;
  flex-shrink: 0;
}

.skill-entry-input--path {
  flex: 1;
  min-width: 0;
}

.skill-entry-actions {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
}

.entry-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  flex-shrink: 0;
}

.entry-icon-btn--confirm {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  color: #2e7d32;
}

.entry-icon-btn--confirm:hover {
  background: #d0edcf;
  border-color: #a5d6a7;
}

.entry-icon-btn--cancel {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  color: #888;
}

.entry-icon-btn--cancel:hover {
  background: #fce8e8;
  border-color: #f5c0c0;
  color: #d93025;
}

.entry-icon-btn--browse {
  background: #f0f4ff;
  border: 1px solid #c0d0f0;
  color: #4a6fb5;
}

.entry-icon-btn--browse:hover {
  background: #e0ecff;
  border-color: #a0b8e0;
}
</style>
