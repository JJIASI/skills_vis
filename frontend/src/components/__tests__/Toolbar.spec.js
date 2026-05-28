import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Toolbar from "../../components/Toolbar.vue";

describe("Toolbar", () => {
  it("shows modelValue in the path input", () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "/tmp/skills" } });
    expect(wrapper.find("[data-test='path-display']").element.value).toBe("/tmp/skills");
  });

  it("shows empty input when modelValue is empty", () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "" } });
    expect(wrapper.find("[data-test='path-display']").element.value).toBe("");
  });

  it("emits open-drawer when the skills drawer button is clicked", async () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "" } });
    await wrapper.find("[data-test='open-drawer']").trigger("click");
    expect(wrapper.emitted("open-drawer")).toBeTruthy();
  });

  it("updates path and emits browse when the folder picker selects a directory with an absolute path", async () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "" } });
    const mockFile = {
      path: "/Users/me/projects/skills/README.md",
      webkitRelativePath: "skills/README.md",
    };
    const fileInput = wrapper.find("input[data-test='folder-picker']");
    Object.defineProperty(fileInput.element, "files", {
      value: [mockFile],
      configurable: true,
    });
    await fileInput.trigger("change");
    expect(wrapper.emitted("update:modelValue")?.[0][0]).toBe("/Users/me/projects/skills");
    expect(wrapper.emitted("browse")?.[0][0]).toBe("/Users/me/projects/skills");
  });

  it("emits show-hint when the picker cannot expose an absolute path (sandboxed browser)", async () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "" } });
    const mockFile = { webkitRelativePath: "skills/README.md" }; // no .path
    const fileInput = wrapper.find("input[data-test='folder-picker']");
    Object.defineProperty(fileInput.element, "files", {
      value: [mockFile],
      configurable: true,
    });
    await fileInput.trigger("change");
    expect(wrapper.emitted("show-hint")).toBeTruthy();
  });

  it("emits open-import when the Browse button is clicked", async () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "" } });
    await wrapper.find("[data-test='open-import']").trigger("click");
    expect(wrapper.emitted("open-import")).toBeTruthy();
  });

  it("emits open-monitor when the sessions button is clicked", async () => {
    const wrapper = mount(Toolbar, { props: { modelValue: "" } });
    await wrapper.find("[data-test='open-monitor']").trigger("click");
    expect(wrapper.emitted("open-monitor")).toBeTruthy();
  });
});
