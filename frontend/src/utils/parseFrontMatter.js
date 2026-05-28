/**
 * Parses YAML front matter from a markdown file.
 * Front matter must be at the very top of the file, enclosed in triple-dashed lines.
 * Returns an object with extracted fields, or null if no valid front matter found.
 */
export function parseFrontMatter(content) {
  if (!content || typeof content !== "string") return null

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null

  const raw = match[1]
  if (!raw.trim()) return null

  const result = {}

  // Extract top-level simple key: value pairs (non-indented lines only)
  for (const line of raw.split("\n")) {
    if (/^\s/.test(line) || !line.trim()) continue
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)/)
    if (!m) continue
    const key = m[1]
    const val = m[2].trim()
    if (val) {
      result[key] = parseYamlValue(val)
    }
  }

  // Extract tags from any nesting level (e.g., metadata.hermes.tags)
  const tagsMatch = raw.match(/tags\s*:\s*\[([^\]]*)\]/)
  if (tagsMatch) {
    const tags = tagsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    if (tags.length > 0) result.tags = tags
  }

  // Extract related_skills from any nesting level
  const relatedMatch = raw.match(/related_skills\s*:\s*\[([^\]]*)\]/)
  if (relatedMatch) {
    const related = relatedMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    if (related.length > 0) result.related_skills = related
  }

  return Object.keys(result).length > 0 ? result : null
}

function parseYamlValue(val) {
  if (val.startsWith("[") && val.endsWith("]")) {
    return val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
  }
  return val
}
