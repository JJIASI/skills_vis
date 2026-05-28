import { ref } from "vue";
import { getSkills, createSkill, updateSkill as apiUpdateSkill, deleteSkill } from "../api/client.js";

export function useSkillsDrawer() {
  const saved = ref([]);
  const starters = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchSkills() {
    loading.value = true;
    error.value = null;
    try {
      const data = await getSkills();
      saved.value = data.saved;
      starters.value = data.starters;
    } catch (err) {
      error.value = err?.response?.data?.detail || err?.message || "Failed to load skills";
    } finally {
      loading.value = false;
    }
  }

  async function addSkill(payload) {
    const entry = await createSkill(payload);
    saved.value = [entry, ...saved.value];
    // Recompute starters.already_added based on new saved paths
    const savedPaths = new Set(saved.value.map((s) => s.path));
    starters.value = starters.value.map((st) => ({
      ...st,
      already_added: savedPaths.has(st.path),
    }));
    return entry;
  }

  async function editSkill(id, payload) {
    const updated = await apiUpdateSkill(id, payload);
    saved.value = saved.value.map((s) => (s.id === id ? updated : s));
    const savedPaths = new Set(saved.value.map((s) => s.path));
    starters.value = starters.value.map((st) => ({
      ...st,
      already_added: savedPaths.has(st.path),
    }));
    return updated;
  }

  async function removeSkill(id) {
    await deleteSkill(id);
    saved.value = saved.value.filter((s) => s.id !== id);
    const savedPaths = new Set(saved.value.map((s) => s.path));
    starters.value = starters.value.map((st) => ({
      ...st,
      already_added: savedPaths.has(st.path),
    }));
  }

  return { saved, starters, loading, error, fetchSkills, addSkill, updateSkill: editSkill, removeSkill };
}
