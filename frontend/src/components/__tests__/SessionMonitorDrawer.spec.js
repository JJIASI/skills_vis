import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import SessionMonitorDrawer from "../SessionMonitorDrawer.vue";

const { mockGetSessionEvents } = vi.hoisted(() => ({
  mockGetSessionEvents: vi.fn(),
}));

vi.mock("../../api/client.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSessionEvents: mockGetSessionEvents };
});

beforeEach(() => {
  mockGetSessionEvents.mockResolvedValue([]);
});

function makeWrapper(props = {}) {
  return mount(SessionMonitorDrawer, {
    props: {
      open: true,
      usageSessions: [],
      isRecording: false,
      isReplaying: false,
      invokedSkillNames: [],
      activePaths: new Set(),
      saved: [],
      ...props,
    },
  });
}

describe("SessionMonitorDrawer", () => {
  it("renders when open=true", () => {
    const w = makeWrapper();
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(true);
  });

  it("renders the drawer element regardless of open prop (v-if is in App.vue)", () => {
    const w = makeWrapper({ open: false });
    expect(w.find("[data-test='session-monitor-drawer']").exists()).toBe(true);
  });

  it("close button is present and emits close when clicked", async () => {
    const w = makeWrapper();
    expect(w.find("[data-test='drawer-close']").exists()).toBe(true);
    await w.find("[data-test='drawer-close']").trigger("click");
    expect(w.emitted("close")).toBeTruthy();
  });

  it("shows 'No sessions recorded yet.' when there are no sessions and not recording", () => {
    const w = makeWrapper({ usageSessions: [] });
    expect(w.text()).toContain("No sessions recorded yet.");
  });

  it("does not render a live-session card (removed in favour of toolbar Record button)", () => {
    const w = makeWrapper({ isRecording: true });
    expect(w.find("[data-test='live-session']").exists()).toBe(false);
  });

  it("renders only sessions with event_count > 0", () => {
    const sessions = [
      { id: "s1", started_at: 1700000000, event_count: 3, graph_root: null },
      { id: "s2", started_at: 1700000100, event_count: 0, graph_root: null },
    ];
    const w = makeWrapper({ usageSessions: sessions });
    expect(w.findAll("[data-test='usage-session']").length).toBe(1);
    expect(w.text()).toContain("3 skills");
  });

  it("emits replay-session with session id when replay button is clicked", async () => {
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 2, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions });
    await w.find("[data-test='replay-btn']").trigger("click");
    expect(w.emitted("replay-session")).toEqual([["s1"]]);
  });

  it("emits delete-session after user confirms the dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 2, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions });
    await w.find("[data-test='delete-session-btn']").trigger("click");
    expect(w.emitted("delete-session")).toEqual([["s1"]]);
    vi.restoreAllMocks();
  });

  it("does not emit delete-session when user cancels the dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 2, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions });
    await w.find("[data-test='delete-session-btn']").trigger("click");
    expect(w.emitted("delete-session")).toBeFalsy();
    vi.restoreAllMocks();
  });

  it("expand button fetches and shows session events", async () => {
    mockGetSessionEvents.mockResolvedValueOnce([
      { id: "e1", skill_name: "my-skill", skill_path: "/path/to/skill" },
    ]);
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 1, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions });
    await w.find("[data-test='expand-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='session-events-list']").exists()).toBe(true);
    expect(w.text()).toContain("my-skill");
    expect(w.text()).toContain("/path/to/skill");
  });

  it("shows session skill tag when saved skill matches session graph_root", () => {
    const saved = [{ id: 1, label: "My Skills", path: "/tmp/skills", is_available: true }];
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 2, graph_root: "/tmp/skills" }];
    const w = makeWrapper({ usageSessions: sessions, saved });
    expect(w.find("[data-test='session-skill-tag']").exists()).toBe(true);
    expect(w.text()).toContain("My Skills");
  });

  it("replay button is disabled when isReplaying=true", () => {
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 2, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions, isReplaying: true });
    expect(w.find("[data-test='replay-btn']").attributes("disabled")).toBeDefined();
  });

  it("clicking expand button a second time collapses the session events", async () => {
    mockGetSessionEvents.mockResolvedValueOnce([
      { id: "e1", skill_name: "my-skill", skill_path: "/path/to/skill" },
    ]);
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 1, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions });
    await w.find("[data-test='expand-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='session-events-list']").exists()).toBe(true);
    await w.find("[data-test='expand-btn']").trigger("click");
    expect(w.find("[data-test='session-events-list']").exists()).toBe(false);
  });

  it("autoExpandSessionId auto-expands the matching session", async () => {
    mockGetSessionEvents.mockResolvedValue([
      { id: "e1", skill_name: "auto-skill", skill_path: "/auto/path" },
    ]);
    const sessions = [{ id: "s1", started_at: 1700000000, event_count: 1, graph_root: null }];
    const w = makeWrapper({ usageSessions: sessions, autoExpandSessionId: "s1" });
    await flushPromises();
    expect(w.find("[data-test='session-events-list']").exists()).toBe(true);
    expect(w.text()).toContain("auto-skill");
  });
});
