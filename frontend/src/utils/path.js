// HOME is injected at build time via vite define; falls back to empty string in tests.
const HOME = (typeof __HOME__ !== "undefined" ? __HOME__ : "") || "";
const HOME_RE = HOME ? new RegExp("^" + HOME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : null;

export function collapseHome(path) {
  if (!path || !HOME_RE) return path;
  return path.replace(HOME_RE, "~");
}
