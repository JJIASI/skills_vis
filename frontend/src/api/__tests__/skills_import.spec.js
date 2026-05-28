import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("axios", () => ({
  default: { create: vi.fn(() => ({ post: mockPost })) },
}));

// Import AFTER mock is registered
const { scanSkills, importSkills } = await import("../skills_import.js");

beforeEach(() => { mockPost.mockReset(); });

describe("scanSkills", () => {
  it("posts to /skills/scan and returns data", async () => {
    const fakeData = { source_label: "org/repo", skills: [{ name: "a", description: "desc" }] };
    mockPost.mockResolvedValue({ data: fakeData });
    const result = await scanSkills({ source: "github", url: "https://github.com/org/repo" });
    expect(mockPost).toHaveBeenCalledWith("/skills/scan", { source: "github", url: "https://github.com/org/repo" });
    expect(result).toEqual(fakeData);
  });

  it("throws { status, detail } on non-2xx response", async () => {
    mockPost.mockRejectedValue({ response: { status: 404, data: { detail: "Not found" } } });
    await expect(scanSkills({ source: "local", path: "/missing" })).rejects.toMatchObject({ status: 404, detail: "Not found" });
  });
});

describe("importSkills", () => {
  it("posts to /skills/import and returns data on 200", async () => {
    const fakeData = { imported: ["a"], skipped: [], destination: "/graph" };
    mockPost.mockResolvedValue({ data: fakeData });
    const result = await importSkills({ source: "local", path: "/src", skill_names: ["a"] });
    expect(result).toEqual(fakeData);
  });

  it("throws { conflicts } on 409", async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { conflicts: ["a"] } } });
    await expect(importSkills({ source: "local", path: "/src", skill_names: ["a"] }))
      .rejects.toMatchObject({ conflicts: ["a"] });
  });

  it("throws { status, detail } on 502", async () => {
    mockPost.mockRejectedValue({ response: { status: 502, data: { detail: "Clone failed" } } });
    await expect(importSkills({ source: "local", path: "/src", skill_names: ["a"] }))
      .rejects.toMatchObject({ status: 502, detail: "Clone failed" });
  });

  it("throws { status, detail } with fallback message when response detail absent", async () => {
    mockPost.mockRejectedValue({ response: { status: 500 }, message: "Network Error" });
    await expect(importSkills({ source: "local", path: "/src", skill_names: ["a"] }))
      .rejects.toMatchObject({ status: 500, detail: "Network Error" });
  });
});
