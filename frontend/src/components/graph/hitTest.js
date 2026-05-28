import { DIAMOND_SIZE, FOLDER_H, FOLDER_W, NODE_R } from "./sceneModel.js";

function insideRoundedRect(node, point) {
  const rx = 6;
  const left = node.x - FOLDER_W / 2;
  const right = node.x + FOLDER_W / 2;
  const top = node.y - FOLDER_H / 2;
  const bottom = node.y + FOLDER_H / 2;
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return false;
  if (
    (point.x >= left + rx && point.x <= right - rx) ||
    (point.y >= top + rx && point.y <= bottom - rx)
  ) return true;
  const cx = point.x < node.x ? left + rx : right - rx;
  const cy = point.y < node.y ? top + rx : bottom - rx;
  const dx = point.x - cx;
  const dy = point.y - cy;
  return dx * dx + dy * dy <= rx * rx;
}

function insideCircle(node, point) {
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  return dx * dx + dy * dy <= NODE_R * NODE_R;
}

function insideDiamond(node, point) {
  const dx = Math.abs(point.x - node.x);
  const dy = Math.abs(point.y - node.y);
  return dx + dy <= DIAMOND_SIZE;
}

function inLabel(node, point) {
  return (
    point.x >= node.labelRect.x1 &&
    point.x <= node.labelRect.x2 &&
    point.y >= node.labelRect.y1 &&
    point.y <= node.labelRect.y2
  );
}

export function hitTestScene(scene, scenePoint) {
  for (let i = scene.nodes.length - 1; i >= 0; i -= 1) {
    const node = scene.nodes[i];
    if (node.shape === "folder" && insideRoundedRect(node, scenePoint)) return { kind: "node", node };
    if (node.shape === "file" && insideCircle(node, scenePoint)) return { kind: "node", node };
    if (node.shape === "diamond" && insideDiamond(node, scenePoint)) return { kind: "node", node };
    if (inLabel(node, scenePoint)) return { kind: "label", node };
  }
  return { kind: "none" };
}
