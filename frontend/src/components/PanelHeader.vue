<template>
  <div class="panel-header">
    <span data-test="panel-label" class="panel-label">{{ label }}</span>
    <button
      type="button"
      data-test="expand-btn"
      class="panel-expand-btn"
      :aria-label="isExpanded ? `Exit ${label.toLowerCase()} full page` : `Expand ${label.toLowerCase()} panel`"
      @click="emit('toggle')"
    >
      <svg v-if="!isExpanded" data-test="icon-expand" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- expand arrows pointing outward -->
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
      </svg>
      <svg v-else data-test="icon-exit" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- compress arrows pointing inward -->
        <polyline points="4 14 10 14 10 20"/>
        <polyline points="20 10 14 10 14 4"/>
        <line x1="10" y1="14" x2="3" y2="21"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true,
    validator: (v) => v.trim().length > 0,
  },
  isExpanded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle'])
</script>
