import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import GraphPanel from "../GraphPanel.vue";
import * as transitionModel from "../graph/transitionModel.js";

const sampleTree = {
  name: "skills",
  path: "/skills",
  type: "folder",
  children: [
    {
      name: "docs",
      path: "/skills/docs",
      type: "folder",
      children: [{ name: "guide.md", path: "/skills/docs/guide.md", type: "file" }],
    },
    { name: "README.md", path: "/skills/README.md", type: "file" },
  ],
};

function mountPanel(extraProps = {}) {
  return mount(GraphPanel, {
    props: {
      tree: sampleTree,
      expanded: { "/skills": true },
      selectedNode: null,
      transform: { x: 40, y: 40, scale: 1 },
      ...extraProps,
    },
  });
}

async function flushFrame() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("GraphPanel (canvas)", () => {
  it("renders canvas surface and no node DOM hotspots", () => {
    const wrapper = mountPanel();
    expect(wrapper.find("[data-test='graph-canvas']").exists()).toBe(true);
    expect(wrapper.findAll("[data-node-path]")).toHaveLength(0);
  });

  it("shows empty fallback when tree is null", () => {
    const wrapper = mountPanel({ tree: null });
    expect(wrapper.find("[data-test='graph-empty']").exists()).toBe(true);
  });

  it("emits select for file click and select+toggle for folder click", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    // README.md (file) at scene (230,50) → canvas (270,90) with transform (40,40)
    wrapper.vm.tapAtForTest({ x: 270, y: 90 });
    expect(wrapper.emitted("select")[0][0].path).toBe("/skills/README.md");
    expect(wrapper.emitted("toggle")).toBeFalsy();

    // docs (folder) at scene (230,0) → canvas (270,40)
    wrapper.vm.tapAtForTest({ x: 270, y: 40, pointerId: 2 });
    expect(wrapper.emitted("select")[1][0].path).toBe("/skills/docs");
    expect(wrapper.emitted("toggle")[0][0]).toBe("/skills/docs");
  });

  it("emits context-menu for node right click only", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    // README.md (file) at scene (230,50) → canvas (270,90)
    wrapper.vm.contextMenuAtForTest({ x: 270, y: 90 });
    expect(wrapper.emitted("context-menu")[0][0]).toMatchObject({
      x: 270,
      y: 90,
      node: { path: "/skills/README.md" },
    });

    wrapper.vm.contextMenuAtForTest({ x: 10, y: 10 });
    expect(wrapper.emitted("context-menu")).toHaveLength(1);
  });

  it("does not commit select/toggle on right-click pointer release", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    wrapper.vm.dragForTest({
      start: { pointerId: 12, pointerType: "mouse", button: 2, clientX: 200, clientY: 90 },
      move: { pointerId: 12, pointerType: "mouse", button: 2, clientX: 200, clientY: 90 },
      end: { pointerId: 12, pointerType: "mouse", button: 2, clientX: 200, clientY: 90 },
    });
    expect(wrapper.emitted("select")).toBeFalsy();
    expect(wrapper.emitted("toggle")).toBeFalsy();
  });

  it("drag threshold cancels click behavior", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    wrapper.vm.dragForTest({
      start: { pointerId: 3, pointerType: "mouse", clientX: 200, clientY: 90 },
      move: { pointerId: 3, pointerType: "mouse", clientX: 250, clientY: 140 },
      end: { pointerId: 3, pointerType: "mouse", clientX: 250, clientY: 140 },
    });
    expect(wrapper.emitted("select")).toBeFalsy();
    expect(wrapper.emitted("toggle")).toBeFalsy();
  });

  it("emits update:transform on wheel zoom and two-finger pinch", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    wrapper.vm.wheelAtForTest({ x: 200, y: 90, deltaY: -100 });
    expect(wrapper.emitted("update:transform")).toBeTruthy();

    wrapper.vm.pinchForTest({
      startA: { pointerId: 4, pointerType: "touch", clientX: 120, clientY: 120 },
      startB: { pointerId: 5, pointerType: "touch", clientX: 220, clientY: 120 },
      moveB: { pointerId: 5, pointerType: "touch", clientX: 250, clientY: 120 },
    });
    expect(wrapper.emitted("update:transform").length).toBeGreaterThan(1);
  });

  it("enters suspended state on zero size and recovers", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    wrapper.vm.setHostSizeForTest(0, 0);
    await flushFrame();
    expect(wrapper.find("[data-test='graph-error']").exists()).toBe(false);
    wrapper.vm.setHostSizeForTest(800, 600);
    await flushFrame();
    expect(wrapper.find("[data-test='graph-error']").exists()).toBe(false);
  });

  it("shows error fallback if canvas context cannot initialize", async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null;
    const wrapper = mountPanel();
    await flushFrame();
    expect(wrapper.find("[data-test='graph-error']").exists()).toBe(true);
    HTMLCanvasElement.prototype.getContext = original;
  });

  it("uses HiDPI backing buffer sizing", async () => {
    const wrapper = mountPanel();
    await flushFrame();
    const canvas = wrapper.find("canvas").element;
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
  });

  it("clears hover across remount", async () => {
    const first = mountPanel();
    await flushFrame();
    // docs (folder) at scene (230,0) → canvas (270,40)
    first.vm.moveAtForTest({ x: 270, y: 40 });
    expect(first.vm.hoverPathForTest()).toBe("/skills/docs");
    first.unmount();

    const second = mountPanel();
    await flushFrame();
    expect(second.vm.hoverPathForTest()).toBe(null);
  });

  it("renders search UI and emits query and match navigation events", async () => {
    const wrapper = mountPanel({
      searchQuery: "",
      searchMatches: ["/skills/docs/guide.md", "/skills/README.md"],
      activeSearchPath: "/skills/docs/guide.md",
    });
    const input = wrapper.find("[data-test='graph-search-input']");
    expect(input.exists()).toBe(true);
    expect(wrapper.find("[data-test='graph-search-count']").text()).toBe("1/2");

    await input.setValue("guide");
    expect(wrapper.emitted("update:searchQuery")?.[0]).toEqual(["guide"]);

    await input.trigger("keydown.enter");
    expect(wrapper.emitted("next-search-match")).toHaveLength(1);

    await input.trigger("keydown.enter", { shiftKey: true });
    expect(wrapper.emitted("prev-search-match")).toHaveLength(1);
  });

  it("starts animation for small expand change", async () => {
    const wrapper = mountPanel({ expanded: { "/skills": true } });
    await flushFrame();
    await wrapper.setProps({ expanded: { "/skills": true, "/skills/docs": true } });
    expect(wrapper.vm.isAnimatingForTest()).toBe(true);
  });

  it("skips animation when changedCount exceeds threshold", async () => {
    const spy = vi
      .spyOn(transitionModel, "planTransition")
      .mockReturnValue({ matched: [], entering: [], exiting: [], changedCount: 999 });
    const wrapper = mountPanel({ expanded: { "/skills": true } });
    await flushFrame();
    await wrapper.setProps({ expanded: { "/skills": true, "/skills/docs": true } });
    expect(wrapper.vm.isAnimatingForTest()).toBe(false);
    spy.mockRestore();
  });

  it("restarts animation when a second toggle arrives mid-flight", async () => {
    const wrapper = mountPanel({ expanded: { "/skills": true } });
    await flushFrame();
    await wrapper.setProps({ expanded: { "/skills": true, "/skills/docs": true } });
    const firstId = wrapper.vm.animationSessionIdForTest();
    await wrapper.setProps({ expanded: { "/skills": true } });
    expect(wrapper.vm.animationSessionIdForTest()).not.toBe(firstId);
  });

  it("runs for both expand and collapse", async () => {
    const wrapper = mountPanel({ expanded: { "/skills": true } });
    await flushFrame();
    await wrapper.setProps({ expanded: { "/skills": true, "/skills/docs": true } });
    const expandFrames = wrapper.vm.animationFrameCountForTest();
    await wrapper.setProps({ expanded: { "/skills": true } });
    const collapseFrames = wrapper.vm.animationFrameCountForTest();
    expect(expandFrames).toBeGreaterThan(0);
    expect(collapseFrames).toBeGreaterThan(expandFrames);
  });
});
