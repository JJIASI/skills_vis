export function classifyFile(path) {
  if (path.endsWith(".md") || path.endsWith(".mdc")) return "markdown"
  if (/\.(py|js|ts|json|vue|css|html|sh|yml|yaml|toml|ini|sql|go|rs|java|c|cc|cpp|h|hpp)$/.test(path)) return "code"
  return "text"
}
