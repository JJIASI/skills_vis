import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SkillsDrawer from "../SkillsDrawer.vue";

const SAVED = [
  { id: 1, label: "My Skills", path: "/tmp/skills", is_available: true },
  { id: 2, label: "Offline", path: "/nonexistent", is_available: false },
];
const STARTERS = [
  { key: "copilot", name: "Copilot", path: "/home/.copilot/skills", already_added: false },
  { key: "claude-code", name: "Claude Code", path: "/home/.claude/skills", already_added: true },
];

function makeWrapper(props = {}) {
  return mount(SkillsDrawer, {
    props: {
      open: true,
      saved: SAVED,
      starters: STARTERS,
      loading: false,
      error: null,
      ...props,
    },
  });
}

describe("SkillsDrawer", () => {
  it("renders section headings and entry labels", () => {
    const w = makeWrapper();
    expect(w.text()).toContain("Your skills");      // spec-required heading
    expect(w.text()).toContain("Popular starters"); // spec-required heading
    expect(w.text()).toContain("My Skills");
    expect(w.text()).toContain("Offline");
    expect(w.text()).toContain("Copilot");
    expect(w.text()).toContain("Claude Code");
  });

  it("renders the drawer element regardless of open prop (v-if is in App.vue)", () => {
    const w = makeWrapper({ open: false });
    expect(w.find("[data-test='skills-drawer']").exists()).toBe(true);
  });

  it("close button is present and emits close when clicked", async () => {
    const w = makeWrapper();
    expect(w.find("[data-test='drawer-close']").exists()).toBe(true);
    await w.find("[data-test='drawer-close']").trigger("click");
    expect(w.emitted("close")).toBeTruthy();
  });

  it("emits select with the entry when an available saved entry is clicked", async () => {
    const w = makeWrapper();
    await w.find("[data-test='select-skill-1']").trigger("click");
    expect(w.emitted("select")).toEqual([[SAVED[0]]]);
  });

  it("unavailable saved entries are not clickable (no select emit)", async () => {
    const w = makeWrapper();
    const btn = w.find("[data-test='select-skill-2']");
    expect(btn.exists()).toBe(false); // unavailable entries have no select button
  });

  it("already-added starters show disabled state", () => {
    const w = makeWrapper();
    const addBtn = w.find("[data-test='add-starter-claude-code']");
    expect(addBtn.attributes("disabled")).toBeDefined();
  });

  it("emits add-starter with starter payload when add button clicked", async () => {
    const w = makeWrapper();
    await w.find("[data-test='add-starter-copilot']").trigger("click");
    expect(w.emitted("add-starter")).toEqual([[STARTERS[0]]]);
  });

  it("shows error message and a retry button when error prop is set", async () => {
    const w = makeWrapper({ error: "Failed to load" });
    expect(w.text()).toContain("Failed to load");
    const retry = w.find("[data-test='drawer-retry']");
    expect(retry.exists()).toBe(true);
    await retry.trigger("click");
    expect(w.emitted("retry")).toBeTruthy();
  });

  it("shows loading indicator when loading=true", () => {
    const w = makeWrapper({ loading: true });
    expect(w.find("[data-test='drawer-loading']").exists()).toBe(true);
  });

  it("clicking add-manually button shows the entry form; submitting emits add with payload", async () => {
    const w = makeWrapper({ saved: [], starters: [] });
    await w.find("[data-test='drawer-add-manual']").trigger("click");
    const form = w.find("[data-test='skill-entry-form']");
    expect(form.exists()).toBe(true);
    await w.find("[data-test='skill-path-input']").setValue("/tmp/new-skill");
    await w.find("[data-test='skill-form-submit']").trigger("click");
    // Empty label field must be normalized to null (not ""), per backend schema (label is nullable)
    expect(w.emitted("add")).toEqual([[{ label: null, path: "/tmp/new-skill" }]]);
  });

  it("does not render the drawer-load section (path input, browse, load buttons)", () => {
    const w = mount(SkillsDrawer, { props: { open: true, saved: [], starters: [] } });
    expect(w.find("[data-test='drawer-path-input']").exists()).toBe(false);
    expect(w.find("[data-test='drawer-load']").exists()).toBe(false);
  });

  it("drawer-add-manual button opens the add form", async () => {
    const w = mount(SkillsDrawer, { props: { open: true, saved: [], starters: [] } });
    await w.find("[data-test='drawer-add-manual']").trigger("click");
    expect(w.find("[data-test='skill-entry-form']").exists()).toBe(true);
  });

  it("does not render the Usage Sessions section", () => {
    const w = makeWrapper();
    expect(w.text()).not.toContain("Usage Sessions");
    expect(w.find("[data-test='live-session']").exists()).toBe(false);
  });
});

describe("current workspace", () => {
  it("shows current workspace button when activeRootPath is set (and not in saved)", () => {
    const w = makeWrapper({ activeRootPath: "/home/user/my-workspace" });
    expect(w.find('[data-test="current-workspace-btn"]').exists()).toBe(true);
    expect(w.text()).toContain("/home/user/my-workspace");
  });

  it("does not show current workspace section when activeRootPath is null", () => {
    const w = makeWrapper({ activeRootPath: null });
    expect(w.find('[data-test="current-workspace-btn"]').exists()).toBe(false);
  });

  it("emits select with the workspace path when current workspace is clicked", async () => {
    const w = makeWrapper({ activeRootPath: "/home/user/my-workspace" });
    await w.find('[data-test="current-workspace-btn"]').trigger("click");
    expect(w.emitted("select")).toEqual([[{ path: "/home/user/my-workspace" }]]);
  });
});
