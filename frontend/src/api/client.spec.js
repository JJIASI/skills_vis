import { describe, it, expect, vi, beforeEach } from "vitest";
import { openUsageStream } from "./client.js";

describe("openUsageStream", () => {
  let mockES;
  beforeEach(() => {
    mockES = { onmessage: null };
    global.EventSource = vi.fn(() => mockES);
  });

  it("creates EventSource with session_id query param", () => {
    openUsageStream("my-session-id", vi.fn());
    expect(global.EventSource).toHaveBeenCalledWith(
      "/api/usage/stream?session_id=my-session-id"
    );
  });

  it("creates EventSource at base URL when session_id is null", () => {
    openUsageStream(null, vi.fn());
    expect(global.EventSource).toHaveBeenCalledWith("/api/usage/stream");
  });

  it("calls onEvent with parsed JSON when a message arrives", () => {
    const onEvent = vi.fn();
    openUsageStream("sid", onEvent);
    mockES.onmessage({ data: JSON.stringify({ skill_path: "brainstorming", session_id: "sid" }) });
    expect(onEvent).toHaveBeenCalledWith({ skill_path: "brainstorming", session_id: "sid" });
  });

  it("silently ignores malformed JSON without throwing", () => {
    const onEvent = vi.fn();
    openUsageStream("sid", onEvent);
    expect(() => mockES.onmessage({ data: "not-json{{" })).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("returns the EventSource instance", () => {
    const es = openUsageStream("sid", vi.fn());
    expect(es).toBe(mockES);
  });
});
