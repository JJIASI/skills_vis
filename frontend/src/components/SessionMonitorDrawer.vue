<template>
  <aside class="drawer-aside right" data-test="session-monitor-drawer">

    <!-- Header -->
    <div class="drawer-hd">
      <h3>Recording Sessions</h3>
      <div style="display: flex; gap: 4px;">
        <button class="drawer-hd-icon" title="Close" data-test="drawer-close" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- History -->
    <div class="sess-history-hd">
      <span>History</span>
      <span class="count">{{ visibleSessions.length }} sessions</span>
    </div>

    <div class="sess-history-list">
      <div
        v-if="!visibleSessions.length"
        class="sess-empty"
        data-test="usage-empty"
      >
        No sessions recorded yet.
      </div>

      <div
        v-for="session in visibleSessions"
        :key="session.id"
        class="sess-row"
        data-test="usage-session"
      >
        <span class="when">{{ formatWhen(session.started_at) }}</span>

        <div class="mid">
          <div class="ttl">{{ session.title || formatTitle(session) }}</div>
          <div class="sub">
            <span>{{ session.event_count }} skills</span>
            <span style="color: var(--subtle);">·</span>
            <span class="mono" style="font-size: 10px;">{{ session.agent || 'claude-code' }}</span>
          </div>
          <div class="sess-bar"><i :style="{ width: Math.round((session.event_count / maxEventCount) * 100) + '%' }" /></div>
          <div class="skill-tags">
            <span
              v-if="sessionSkillLabel(session)"
              class="skill-tag"
              data-test="session-skill-tag"
            >{{ sessionSkillLabel(session) }}</span>
            <span
              v-for="(tag, i) in getTopSkills(session)"
              :key="i"
              class="skill-tag"
            >{{ tag }}</span>
          </div>
          <!-- Expanded events -->
          <ul v-if="expandedSessions.has(session.id)" class="usage-skill-list" data-test="session-events-list">
            <li
              v-for="event in (sessionEventsCache[session.id] || [])"
              :key="event.id"
              class="usage-skill-item"
              :class="{ 'usage-skill-item--active': activePaths.has(event.skill_path) }"
              @click="$emit('select-skill', event.skill_path)"
            >
              <span class="usage-skill-name">{{ event.skill_name }}</span>
              <span class="usage-skill-path">{{ event.skill_path }}</span>
            </li>
            <li v-if="!(sessionEventsCache[session.id] || []).length" class="usage-skill-empty">
              No skills recorded.
            </li>
          </ul>
        </div>

        <div class="sess-row-actions">
          <button
            class="sess-action-btn"
            :disabled="isRecording || isReplaying"
            title="Replay"
            data-test="replay-btn"
            @click="$emit('replay-session', session.id)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7L8 5z"/>
            </svg>
          </button>
          <button
            class="sess-action-btn"
            :aria-expanded="expandedSessions.has(session.id)"
            :title="expandedSessions.has(session.id) ? 'Collapse' : 'Expand skills'"
            data-test="expand-btn"
            @click="toggleSessionEvents(session.id)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path v-if="expandedSessions.has(session.id)" d="M18 15l-6-6-6 6"/>
              <path v-else d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <button
            class="sess-action-btn danger"
            title="Delete session"
            data-test="delete-session-btn"
            @click="confirmDelete(session.id)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { getSessionEvents } from "../api/client.js";

const props = defineProps({
  open: { type: Boolean, default: false },
  usageSessions: { type: Array, default: () => [] },
  isRecording: { type: Boolean, default: false },
  isReplaying: { type: Boolean, default: false },
  activePaths: { type: Object, default: () => new Set() },
  autoExpandSessionId: { type: String, default: null },
  saved: { type: Array, default: () => [] },
});

const emit = defineEmits(["replay-session", "delete-session", "toggle-record", "close", "select-skill"]);

function confirmDelete(sessionId) {
  if (window.confirm("Delete this session? This cannot be undone.")) {
    emit("delete-session", sessionId);
  }
}

const expandedSessions = ref(new Set());
const sessionEventsCache = ref({});

const visibleSessions = computed(() => props.usageSessions.filter(s => s.event_count > 0));
const maxEventCount = computed(() => Math.max(1, ...visibleSessions.value.map(s => s.event_count)));

function formatWhen(ts) {
  if (!ts) return '';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  if (diff < 172800) return 'yest';
  return `${Math.round(diff / 86400)}d`;
}

function formatTitle(session) {
  if (session.graph_root) {
    const match = props.saved.find(s => s.path === session.graph_root);
    return match ? (match.label || match.path) : session.graph_root.split('/').pop();
  }
  return new Date(session.started_at * 1000).toLocaleString(undefined, {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function sessionSkillLabel(session) {
  if (!session.graph_root) return null;
  const match = props.saved.find(s => s.path === session.graph_root);
  return match ? (match.label || match.path) : null;
}

function getTopSkills(session) {
  if (sessionEventsCache.value[session.id]) {
    const names = sessionEventsCache.value[session.id].map(e => e.skill_name);
    const counts = {};
    for (const n of names) counts[n] = (counts[n] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  }
  return [];
}

watch(() => props.autoExpandSessionId, async (id) => {
  if (!id) return;
  expandedSessions.value = new Set();
  if (!sessionEventsCache.value[id]) {
    sessionEventsCache.value = { ...sessionEventsCache.value, [id]: await getSessionEvents(id) };
  }
  expandedSessions.value = new Set([id]);
}, { immediate: true });

async function toggleSessionEvents(sessionId) {
  if (expandedSessions.value.has(sessionId)) {
    expandedSessions.value = new Set([...expandedSessions.value].filter(id => id !== sessionId));
  } else {
    if (!sessionEventsCache.value[sessionId]) {
      const events = await getSessionEvents(sessionId);
      sessionEventsCache.value = { ...sessionEventsCache.value, [sessionId]: events };
    }
    expandedSessions.value = new Set([...expandedSessions.value, sessionId]);
  }
}
</script>
