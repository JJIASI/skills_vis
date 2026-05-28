Object.defineProperty(window, "devicePixelRatio", {
  value: 2,
  configurable: true,
});

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.visualViewport) {
  window.visualViewport = {
    addEventListener() {},
    removeEventListener() {},
  };
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, width: 800, height: 600, right: 800, bottom: 600 };
};

HTMLCanvasElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, width: 800, height: 600, right: 800, bottom: 600 };
};

HTMLCanvasElement.prototype.getContext = function getContext() {
  return {
    setTransform() {},
    translate() {},
    scale() {},
    clearRect() {},
    fillRect() {},
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    bezierCurveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    fill() {},
    stroke() {},
    roundRect() {},
    setLineDash() {},
    getLineDash() { return []; },
    fillText() {},
    measureText(text) {
      return { width: String(text ?? "").length * 7 };
    },
  };
};

if (globalThis.Range && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
}

if (globalThis.Range && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 });
}
