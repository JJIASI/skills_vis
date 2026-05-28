// Pure helper to plan transitions between two graph scenes
// Scenes are expected to be objects: { nodes: [ { path, x, y, parentAnchor? } ] }

function planTransition(fromScene = { nodes: [] }, toScene = { nodes: [] }) {
  const fromMap = new Map();
  const toMap = new Map();

  (fromScene.nodes || []).forEach(n => fromMap.set(n.path, n));
  (toScene.nodes || []).forEach(n => toMap.set(n.path, n));

  const matched = [];
  const entering = [];
  const exiting = [];

  // matched: present in both
  for (const path of Array.from(new Set([...fromMap.keys(), ...toMap.keys()]))) {
    const f = fromMap.get(path);
    const t = toMap.get(path);
    if (f && t) {
      const moved = f.x !== t.x || f.y !== t.y;
      matched.push({ path, from: { x: f.x, y: f.y }, to: { x: t.x, y: t.y }, moved });
    } else if (!f && t) {
      // entering
      const anchor = t.parentAnchor ? { x: t.parentAnchor.x, y: t.parentAnchor.y } : { x: t.x, y: t.y };
      entering.push({ path, anchor });
    } else if (f && !t) {
      // exiting
      const anchor = f.parentAnchor ? { x: f.parentAnchor.x, y: f.parentAnchor.y } : { x: f.x, y: f.y };
      exiting.push({ path, anchor });
    }
  }

  // deterministic ordering by path
  const sortByPath = arr => arr.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  sortByPath(matched);
  sortByPath(entering);
  sortByPath(exiting);

  const movedCount = matched.filter(m => m.moved).length;
  const changedCount = entering.length + exiting.length + movedCount;

  return { matched, entering, exiting, changedCount };
}

export { planTransition };
