// HOME is injected at build time via vite define; falls back to empty string in tests.
// setHome() overrides this at runtime (called with the server's Path.home() on startup).
const _buildHome = (typeof __HOME__ !== "undefined" ? __HOME__ : "") || "";
let _home = _buildHome;
let _homeRe = _home ? new RegExp("^" + _home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : null;

export function setHome(home) {
  _home = home || "";
  _homeRe = _home ? new RegExp("^" + _home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : null;
}

export function collapseHome(path) {
  if (!path || !_homeRe) return path;
  return path.replace(_homeRe, "~");
}
