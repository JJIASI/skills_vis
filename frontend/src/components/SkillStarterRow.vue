<template>
  <div class="skill-starter-row">

    <!-- Icon cell -->
    <div class="starter-icon-cell">
      <span aria-hidden="true">⚡</span>
    </div>

    <!-- Text -->
    <div class="skill-text">
      <div class="skill-main">{{ starter.name }}</div>
      <div class="skill-path">{{ starter.path }}</div>
    </div>

    <!-- Add button -->
    <button
      :data-test="`add-starter-${starter.key}`"
      class="add-icon-btn"
      :class="{ 'add-icon-btn--added': starter.already_added }"
      :disabled="starter.already_added || undefined"
      :title="starter.already_added ? 'Already added' : 'Add'"
      @click="!starter.already_added && $emit('add', starter)"
    >{{ starter.already_added ? '✓' : '＋' }}</button>

  </div>
</template>

<script setup>
defineProps({ starter: { type: Object, required: true } });
defineEmits(["add"]);
</script>

<style scoped>
.skill-starter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid #f5f5f5;
}

.starter-icon-cell {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: #f0f7ee;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
}

.skill-text {
  flex: 1;
  min-width: 0;
}

.skill-main {
  font-size: 13px;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-path {
  font-size: 11px;
  color: #aaa;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.add-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #c8e6c9;
  border-radius: 6px;
  background: #f0f7ee;
  color: #2e7d32;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  transition: background 0.1s, border-color 0.1s;
}

.add-icon-btn:hover:not(:disabled) {
  background: #e0f0dc;
  border-color: #a5d6a7;
}

.add-icon-btn--added,
.add-icon-btn:disabled {
  background: #f0f0f0;
  border-color: #ddd;
  color: #aaa;
  cursor: default;
  font-size: 14px;
}
</style>
