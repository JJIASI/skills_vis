import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the API client before importing the composable
vi.mock("../../api/client.js", () => ({
  getSkills: vi.fn(),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
}));

import * as client from "../../api/client.js";
import { useSkillsDrawer } from "../useSkillsDrawer.js";

const SAVED_ENTRY = { id: 1, label: "My Skills", path: "/tmp/skills", is_available: true, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" };
const STARTER = { key: "copilot", name: "Copilot", path: "/home/user/.copilot/skills", already_added: false };

describe("useSkillsDrawer", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("starts with empty state and no error", () => {
    const { saved, starters, loading, error } = useSkillsDrawer();
    expect(saved.value).toEqual([]);
    expect(starters.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("fetchSkills populates saved and starters", async () => {
    client.getSkills.mockResolvedValue({ saved: [SAVED_ENTRY], starters: [STARTER] });
    const { saved, starters, loading, fetchSkills } = useSkillsDrawer();
    const promise = fetchSkills();
    expect(loading.value).toBe(true);
    await promise;
    expect(loading.value).toBe(false);
    expect(saved.value).toEqual([SAVED_ENTRY]);
    expect(starters.value).toEqual([STARTER]);
  });

  it("fetchSkills sets error on failure and keeps existing state", async () => {
    client.getSkills.mockRejectedValue(new Error("network error"));
    const { saved, starters, error, fetchSkills } = useSkillsDrawer();
    await fetchSkills();
    expect(error.value).toBeTruthy();
    expect(saved.value).toEqual([]);
    expect(starters.value).toEqual([]);
  });

  it("addSkill appends the returned entry and recomputes starters already_added", async () => {
    const addedEntry = { ...SAVED_ENTRY };
    // Seed starters with already_added: false so we can verify local recomputation flips it to true
    const starterMatchingPath = { ...STARTER, path: SAVED_ENTRY.path, already_added: false };
    client.getSkills.mockResolvedValue({ saved: [], starters: [starterMatchingPath] });
    client.createSkill.mockResolvedValue(addedEntry);
    const { saved, starters, fetchSkills, addSkill } = useSkillsDrawer();
    await fetchSkills();
    expect(starters.value[0].already_added).toBe(false);
    const result = await addSkill({ label: "My Skills", path: "/tmp/skills" });
    expect(result).toEqual(addedEntry);
    expect(saved.value).toContainEqual(addedEntry);
    expect(starters.value[0].already_added).toBe(true); // composable recomputed locally
    expect(client.createSkill).toHaveBeenCalledWith({ label: "My Skills", path: "/tmp/skills" });
  });

  it("updateSkill patches the matching entry in place", async () => {
    const updated = { ...SAVED_ENTRY, label: "Updated" };
    client.getSkills.mockResolvedValue({ saved: [SAVED_ENTRY], starters: [STARTER] });
    client.updateSkill.mockResolvedValue(updated);
    const { saved, fetchSkills, updateSkill } = useSkillsDrawer();
    await fetchSkills();
    await updateSkill(1, { label: "Updated", path: "/tmp/skills" });
    expect(saved.value.find((s) => s.id === 1)?.label).toBe("Updated");
  });

  it("removeSkill removes the matching entry from saved", async () => {
    const starterWithPath = { ...STARTER, path: SAVED_ENTRY.path, already_added: true };
    client.getSkills.mockResolvedValue({ saved: [SAVED_ENTRY], starters: [starterWithPath] });
    client.deleteSkill.mockResolvedValue(undefined);
    const { saved, starters, fetchSkills, removeSkill } = useSkillsDrawer();
    await fetchSkills();
    await removeSkill(1);
    expect(saved.value.find((s) => s.id === 1)).toBeUndefined();
    expect(starters.value[0].already_added).toBe(false);
  });

  it("addSkill throws and does not mutate state on API failure", async () => {
    client.getSkills.mockResolvedValue({ saved: [], starters: [STARTER] });
    client.createSkill.mockRejectedValue(new Error("409"));
    const { saved, fetchSkills, addSkill } = useSkillsDrawer();
    await fetchSkills();
    await expect(addSkill({ label: "Dup", path: "/tmp/dup" })).rejects.toThrow();
    expect(saved.value).toEqual([]);
  });
});
