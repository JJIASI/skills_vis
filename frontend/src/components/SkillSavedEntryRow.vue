<template>
  <div class="skill-saved-row" :class="{ 'skill-saved-row--unavailable': !entry.is_available }">

    <!-- Icon cell -->
    <div class="skill-icon-cell" :class="{ 'skill-icon-cell--unavailable': !entry.is_available }">
      <span aria-hidden="true">{{ entry.is_available ? '📁' : '⚠️' }}</span>
    </div>

    <!-- Text -->
    <div class="skill-text">
      <div class="skill-main">{{ entry.label || entry.path }}</div>
      <div
        v-if="entry.label || !entry.is_available"
        class="skill-path"
        :class="{ 'skill-path--unavailable': !entry.is_available }"
      >{{ entry.path }}{{ !entry.is_available ? t('skillSavedRow.notFound') : '' }}</div>
    </div>

    <!-- Actions -->
    <div class="skill-actions">
      <button
        v-if="entry.is_available"
        :data-test="`select-skill-${entry.id}`"
        class="icon-btn"
        :title="t('skillSavedRow.open')"
        @click="$emit('select', entry)"
      >
        <!-- Lucide ExternalLink -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
      <button
        :data-test="`edit-skill-${entry.id}`"
        class="icon-btn"
        :title="t('skillSavedRow.edit')"
        @click="$emit('edit', entry)"
      >
        <!-- Lucide Edit2 -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button
        :data-test="`remove-skill-${entry.id}`"
        class="icon-btn icon-btn--danger"
        :title="t('skillSavedRow.remove')"
        @click="$emit('remove', entry.id)"
      >
        <!-- Lucide Trash2 -->
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>

  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({ entry: { type: Object, required: true } });
defineEmits(["select", "edit", "remove"]);
</script>

<style scoped>
.skill-saved-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.1s;
}

.skill-saved-row:hover {
  background: #fafafa;
}

.skill-icon-cell {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #e8f0fe;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 15px;
}

.skill-icon-cell--unavailable {
  background: #fce8e8;
}

.skill-text {
  flex: 1;
  min-width: 0;
}

.skill-main {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-path {
  font-size: 11px;
  color: #999;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.skill-path--unavailable {
  color: #e05656;
}

.skill-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #666;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}

.icon-btn:hover {
  background: #f0f0f0;
  border-color: #ddd;
}

.icon-btn--danger:hover {
  background: #fce8e8;
  border-color: #f5c0c0;
  color: #d93025;
}
</style>
