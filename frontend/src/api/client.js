import axios from "axios";

const http = axios.create({ baseURL: "/api" });

export function getTree(path, depth = 1, setRoot = true) { return http.get("/tree", { params: { path, depth, set_root: setRoot } }).then((r) => r.data); }
export function getFile(path) { return http.get("/file", { params: { path } }).then((r) => r.data); }
export function saveFile(path, content) { return http.put("/file", { path, content }).then((r) => r.data); }
export function renamePath(oldPath, newName) { return http.post("/rename", { old: oldPath, new: newName }).then((r) => r.data); }
export function deleteFile(path) { return http.delete("/file", { params: { path } }) }
export function deleteFolder(path) { return http.delete("/folder", { params: { path } }) }
export function createFile(path, content = "") { return http.post("/create/file", { path, content }).then((r) => r.data); }
export function createFolder(path) { return http.post("/create/folder", { path }).then((r) => r.data); }

export function getSkills() { return http.get("/skills").then((r) => r.data); }
export function getActiveRoot() { return http.get("/active_root").then((r) => r.data); }
export function getServerCwd() { return http.get("/server_cwd").then((r) => r.data); }
export function createSkill(payload) { return http.post("/skills", payload).then((r) => r.data); }
export function updateSkill(id, payload) { return http.put(`/skills/${id}`, payload).then((r) => r.data); }
export function deleteSkill(id) { return http.delete(`/skills/${id}`); }

// Usage monitor API
export function startUsageSession(payload = {}) {
  return http.post("/usage/sessions", payload).then((r) => r.data);
}
export function stopUsageSession(sessionId) {
  return http.put(`/usage/sessions/${sessionId}/stop`).then((r) => r.data);
}
export function recordUsage(payload) {
  return http.post("/usage/record", payload).then((r) => r.data);
}
export function listUsageSessions() {
  return http.get("/usage/sessions").then((r) => r.data);
}
export function getSessionEvents(sessionId) {
  return http.get(`/usage/sessions/${sessionId}/events`).then((r) => r.data);
}
export function deleteUsageSession(sessionId) {
  return http.delete(`/usage/sessions/${sessionId}`).then((r) => r.data);
}

/**
 * Opens an SSE stream for live skill usage events.
 * @param {string|null} sessionId  Filter to a specific session, or null for all.
 * @param {function}    onEvent    Called with the parsed event object on each message.
 * @returns {EventSource}          Call .close() to stop listening.
 */
export function openUsageStream(sessionId, onEvent) {
  const url = sessionId
    ? `/api/usage/stream?session_id=${encodeURIComponent(sessionId)}`
    : "/api/usage/stream";
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // Malformed event — ignore silently
    }
  };
  return es;
}
