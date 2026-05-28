export const MIN_SCALE = 0.05;
export const MAX_SCALE = 2.5;

export function clampScale(scale) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export function screenToCanvas(point, canvasRect, dpr) {
  return {
    x: (point.x - canvasRect.left) * dpr,
    y: (point.y - canvasRect.top) * dpr,
  };
}

export function canvasToScene(canvasPoint, dpr, transform) {
  const cssX = canvasPoint.x / dpr;
  const cssY = canvasPoint.y / dpr;
  return {
    x: (cssX - transform.x) / transform.scale,
    y: (cssY - transform.y) / transform.scale,
  };
}

export function screenToScene(point, canvasRect, dpr, transform) {
  return canvasToScene(screenToCanvas(point, canvasRect, dpr), dpr, transform);
}

export function sceneToScreen(point, canvasRect, transform) {
  return {
    x: canvasRect.left + point.x * transform.scale + transform.x,
    y: canvasRect.top + point.y * transform.scale + transform.y,
  };
}

export function zoomAtPoint(transform, factor, scenePoint) {
  const scale = clampScale(transform.scale * factor);
  const screenX = scenePoint.x * transform.scale + transform.x;
  const screenY = scenePoint.y * transform.scale + transform.y;
  return {
    x: screenX - scenePoint.x * scale,
    y: screenY - scenePoint.y * scale,
    scale,
  };
}
