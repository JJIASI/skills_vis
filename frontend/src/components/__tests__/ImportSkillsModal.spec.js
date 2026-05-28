import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ImportSkillsModal from "../ImportSkillsModal.vue";

const { mockScanSkills, mockImportSkills } = vi.hoisted(() => ({
  mockScanSkills: vi.fn(),
  mockImportSkills: vi.fn(),
}));

vi.mock("../../api/skills_import.js", () => ({
  scanSkills: mockScanSkills,
  importSkills: mockImportSkills,
}));

function mount_modal(props = {}) {
  return mount(ImportSkillsModal, { props: { open: true, ...props } });
}

beforeEach(() => {
  mockScanSkills.mockReset();
  mockImportSkills.mockReset();
});

describe("ImportSkillsModal — Step 1", () => {
  it("renders modal when open=true", () => {
    const w = mount_modal();
    expect(w.find("[data-test='import-modal']").exists()).toBe(true);
  });

  it("is not rendered when open=false", () => {
    const w = mount(ImportSkillsModal, { props: { open: false } });
    expect(w.find("[data-test='import-modal']").exists()).toBe(false);
  });

  it("shows repo tab by default", () => {
    const w = mount_modal();
    expect(w.find("[data-test='repo-url-input']").exists()).toBe(true);
  });

  it("switches to local tab when Local folder is selected", async () => {
    const w = mount_modal();
    await w.find("[data-test='source-local']").trigger("click");
    expect(w.find("[data-test='local-path-input']").exists()).toBe(true);
    expect(w.find("[data-test='repo-url-input']").exists()).toBe(false);
  });

  it("emits close when the close button is clicked", async () => {
    const w = mount_modal();
    await w.find("[data-test='modal-close']").trigger("click");
    expect(w.emitted("close")).toBeTruthy();
  });

  it("calls scanSkills with repo payload and advances to step 2", async () => {
    const skills = [{ name: "brainstorming", description: "Use before coding" }];
    mockScanSkills.mockResolvedValue({ source_label: "org/repo", skills });
    const w = mount_modal();
    await w.find("[data-test='repo-url-input']").setValue("https://github.com/org/repo");
    await w.find("[data-test='scan-btn']").trigger("click");
    await flushPromises();
    expect(mockScanSkills).toHaveBeenCalledWith(
      expect.objectContaining({ source: "github", url: "https://github.com/org/repo" })
    );
    expect(w.find("[data-test='step-2']").exists()).toBe(true);
  });

  it("shows inline error when scan fails", async () => {
    mockScanSkills.mockRejectedValue({ status: 404, detail: "Not found" });
    const w = mount_modal();
    await w.find("[data-test='repo-url-input']").setValue("https://github.com/org/bad");
    await w.find("[data-test='scan-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='scan-error']").text()).toContain("Not found");
  });

  it("shows loading state on scan button while scanning", async () => {
    let resolve;
    mockScanSkills.mockReturnValue(new Promise(r => { resolve = r; }));
    const w = mount_modal();
    await w.find("[data-test='repo-url-input']").setValue("https://github.com/org/repo");
    await w.find("[data-test='scan-btn']").trigger("click");
    expect(w.find("[data-test='scan-btn']").attributes("disabled")).toBeDefined();
    resolve({ source_label: "org/repo", skills: [] });
    await flushPromises();
    // empty results stay on step 1 with error
    expect(w.find("[data-test='scan-error']").text()).toContain("No skills found");
  });

  it("does not show Browse button in browser (no window.electron)", async () => {
    const w = mount_modal();
    await w.find("[data-test='source-local']").trigger("click");
    expect(w.find("[data-test='browse-btn']").exists()).toBe(false);
  });

  it("shows Browse button when window.electron is set", async () => {
    window.electron = {};
    const w = mount_modal();
    await w.find("[data-test='source-local']").trigger("click");
    expect(w.find("[data-test='browse-btn']").exists()).toBe(true);
    delete window.electron;
  });
});

const SKILLS = [
  { name: "brainstorming", description: "Use before coding" },
  { name: "writing-plans", description: "Plan first" },
];

async function mountAtStep2(w) {
  mockScanSkills.mockResolvedValue({ source_label: "org/repo", skills: SKILLS });
  await w.find("[data-test='repo-url-input']").setValue("https://github.com/org/repo");
  await w.find("[data-test='scan-btn']").trigger("click");
  await flushPromises();
}

describe("ImportSkillsModal — Step 2", () => {
  it("shows skill list after successful scan", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    expect(w.findAll("[data-test='skill-item']").length).toBe(2);
  });

  it("shows source label badge with skill count", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    expect(w.find("[data-test='source-badge']").text()).toContain("org/repo");
    expect(w.find("[data-test='source-badge']").text()).toContain("2 skills found");
  });

  it("selects all skills by default", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    const checkboxes = w.findAll("input[type='checkbox']");
    expect(checkboxes.every(cb => cb.element.checked)).toBe(true);
  });

  it("deselects all when None is clicked", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='select-none']").trigger("click");
    const checkboxes = w.findAll("input[type='checkbox']");
    expect(checkboxes.every(cb => !cb.element.checked)).toBe(true);
  });

  it("re-selects all when Select All is clicked", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='select-none']").trigger("click");
    await w.find("[data-test='select-all-btn']").trigger("click");
    const checkboxes = w.findAll("input[type='checkbox']");
    expect(checkboxes.every(cb => cb.element.checked)).toBe(true);
  });

  it("shows correct selection count in footer", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    expect(w.find("[data-test='selection-count']").text()).toContain("2 of 2");
    await w.find("[data-test='select-none']").trigger("click");
    expect(w.find("[data-test='selection-count']").text()).toContain("0 of 2");
  });

  it("returns to step 1 and resets state when Back is clicked", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='back-btn']").trigger("click");
    expect(w.find("[data-test='step-2']").exists()).toBe(false);
    expect(w.find("[data-test='repo-url-input']").exists()).toBe(true);
  });

  it("calls importSkills and emits imported on 200", async () => {
    mockImportSkills.mockResolvedValue({ imported: ["brainstorming"], skipped: [], destination: "/graph" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    expect(mockImportSkills).toHaveBeenCalled();
    expect(w.emitted("imported")).toEqual([[{ destination: "/graph", imported: ["brainstorming"], skipped: [] }]]);
  });

  it("shows import error banner on 502 with retry button", async () => {
    mockImportSkills.mockRejectedValue({ status: 502, detail: "Clone failed" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='error-banner']").text()).toContain("go back and try again");
    expect(w.find("[data-test='retry-btn']").exists()).toBe(true);
  });

  it("shows error banner without retry on 422", async () => {
    mockImportSkills.mockRejectedValue({ status: 422, detail: "Not found" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='error-banner']").exists()).toBe(true);
    expect(w.find("[data-test='retry-btn']").exists()).toBe(false);
  });

  it("disables import button when no skills are selected", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='select-none']").trigger("click");
    expect(w.find("[data-test='import-btn']").attributes("disabled")).toBeDefined();
  });

  it("clicking retry resets to step 1", async () => {
    mockImportSkills.mockRejectedValue({ status: 502, detail: "Clone failed" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='retry-btn']").exists()).toBe(true);
    await w.find("[data-test='retry-btn']").trigger("click");
    expect(w.find("[data-test='step-2']").exists()).toBe(false);
    expect(w.find("[data-test='repo-url-input']").exists()).toBe(true);
  });

  it("toggles individual skill checkbox on click", async () => {
    const w = mount_modal();
    await mountAtStep2(w);
    expect(w.find("[data-test='selection-count']").text()).toContain("2 of 2");
    const checkbox = w.findAll("[data-test='skill-checkbox']")[0];
    await checkbox.trigger("change");
    expect(w.find("[data-test='selection-count']").text()).toContain("1 of 2");
  });

  describe('search filter', () => {
    async function mountAtStep2WithSearch() {
      const w = mount_modal();
      await mountAtStep2(w);
      return w;
    }

    it('renders search input in step 2', async () => {
      const w = await mountAtStep2WithSearch();
      expect(w.find('[data-test="skill-search"]').exists()).toBe(true);
    });

    it('filters skill list by search query', async () => {
      const w = await mountAtStep2WithSearch();
      await w.find('[data-test="skill-search"]').setValue('brain');
      await w.vm.$nextTick();
      const items = w.findAll('[data-test="skill-item"]');
      expect(items.length).toBe(1);
      expect(items[0].text()).toContain('brainstorming');
    });

    it('search is case insensitive', async () => {
      const w = await mountAtStep2WithSearch();
      await w.find('[data-test="skill-search"]').setValue('BRAIN');
      await w.vm.$nextTick();
      const items = w.findAll('[data-test="skill-item"]');
      expect(items.length).toBe(1);
      expect(items[0].text()).toContain('brainstorming');
    });

    it('shows all skills when search is empty', async () => {
      const w = await mountAtStep2WithSearch();
      await w.find('[data-test="skill-search"]').setValue('');
      await w.vm.$nextTick();
      expect(w.findAll('[data-test="skill-item"]').length).toBe(2);
    });

    it('resets search on goBack', async () => {
      const w = await mountAtStep2WithSearch();
      await w.find('[data-test="skill-search"]').setValue('brain');
      await w.vm.$nextTick();
      await w.find('[data-test="back-btn"]').trigger('click');
      // Go to step 2 again
      mockScanSkills.mockResolvedValue({ source_label: 'org/repo', skills: SKILLS });
      await w.find('[data-test="repo-url-input"]').setValue('https://github.com/org/repo');
      await w.find('[data-test="scan-btn"]').trigger('click');
      await flushPromises();
      expect(w.find('[data-test="skill-search"]').element.value).toBe('');
    });

    it('filters skill list by description', async () => {
      const w = await mountAtStep2WithSearch();
      // "coding" appears in brainstorming's description ("Use before coding") but not in any skill name
      await w.find('[data-test="skill-search"]').setValue('coding');
      await w.vm.$nextTick();
      const items = w.findAll('[data-test="skill-item"]');
      expect(items.length).toBe(1);
      expect(items[0].text()).toContain('brainstorming');
    });
  });
});

describe("ImportSkillsModal — conflict dialog", () => {
  it("shows conflict dialog when import returns 409", async () => {
    mockImportSkills
      .mockRejectedValueOnce({ conflicts: ["brainstorming"] })
      .mockResolvedValue({ imported: ["brainstorming"], skipped: [], destination: "/graph" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='conflict-dialog']").exists()).toBe(true);
    expect(w.find("[data-test='conflict-name']").text()).toContain("brainstorming");
  });

  it("re-calls importSkills with resolutions after conflict is resolved", async () => {
    mockImportSkills
      .mockRejectedValueOnce({ conflicts: ["brainstorming"] })
      .mockResolvedValue({ imported: ["brainstorming"], skipped: [], destination: "/graph" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    await w.find("[data-test='conflict-overwrite-btn']").trigger("click");
    await flushPromises();
    const secondCall = mockImportSkills.mock.calls[1][0];
    expect(secondCall.conflict_resolution).toEqual({ brainstorming: "overwrite" });
  });

  it("records skip resolution when Skip is clicked", async () => {
    mockImportSkills
      .mockRejectedValueOnce({ conflicts: ["brainstorming"] })
      .mockResolvedValue({ imported: [], skipped: ["brainstorming"], destination: "/graph" });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    await w.find("[data-test='conflict-skip']").trigger("click");
    await flushPromises();
    const secondCall = mockImportSkills.mock.calls[1][0];
    expect(secondCall.conflict_resolution).toEqual({ brainstorming: "skip" });
  });

  it("Cancel dismisses conflict dialog without re-importing", async () => {
    mockImportSkills.mockRejectedValueOnce({ conflicts: ["brainstorming"] });
    const w = mount_modal();
    await mountAtStep2(w);
    await w.find("[data-test='import-btn']").trigger("click");
    await flushPromises();
    expect(w.find("[data-test='conflict-dialog']").exists()).toBe(true);
    await w.find("[data-test='conflict-cancel-btn']").trigger("click");
    expect(w.find("[data-test='conflict-dialog']").exists()).toBe(false);
    expect(w.find("[data-test='step-2']").exists()).toBe(true);
    expect(mockImportSkills).toHaveBeenCalledTimes(1);
  });
});

describe('default subfolder', () => {
  it('pre-fills subfolder input with "skills" for repo mode', async () => {
    const wrapper = mount(ImportSkillsModal, {
      props: { open: true },
      global: { provide: { api: null } },
    });
    const input = wrapper.find('[data-test="subfolder-input"]');
    expect(input.element.value).toBe('skills');
  });
});

describe('saved paths dropdown (local mode)', () => {
  it('shows available saved paths in local mode', async () => {
    const mockApi = {
      getSkills: vi.fn().mockResolvedValue({
        saved: [
          { id: 1, label: 'My Skills', path: '/home/user/skills', is_available: true },
          { id: 2, label: 'Other', path: '/other', is_available: false },
        ],
        starters: [],
      }),
    };
    const w = mount(ImportSkillsModal, {
      props: { open: true },
      global: { provide: { api: mockApi } },
    });
    await w.find('[data-test="source-local"]').trigger('click');
    await flushPromises();
    const select = w.find('[data-test="saved-paths-select"]');
    expect(select.exists()).toBe(true);
    const options = select.findAll('option').filter(o => o.element.value !== '');
    expect(options.length).toBe(1);
    expect(options[0].text()).toContain('My Skills');
    expect(options[0].text()).toContain('/home/user/skills');
  });

  it('clicking a saved path fills local path input', async () => {
    const mockApi = {
      getSkills: vi.fn().mockResolvedValue({
        saved: [
          { id: 1, label: 'My Skills', path: '/home/user/skills', is_available: true },
        ],
        starters: [],
      }),
    };
    const w = mount(ImportSkillsModal, {
      props: { open: true },
      global: { provide: { api: mockApi } },
    });
    await w.find('[data-test="source-local"]').trigger('click');
    await flushPromises();
    const select = w.find('[data-test="saved-paths-select"]');
    await select.setValue('/home/user/skills');
    expect(w.find('[data-test="local-path-input"]').element.value).toBe('/home/user/skills');
  });

  it('does not show saved paths section when api is null', async () => {
    const w = mount(ImportSkillsModal, {
      props: { open: true },
      global: { provide: { api: null } },
    });
    await w.find('[data-test="source-local"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-test="saved-paths-select"]').exists()).toBe(false);
  });

  it('does not show unavailable saved paths', async () => {
    const mockApi = {
      getSkills: vi.fn().mockResolvedValue({
        saved: [
          { id: 1, label: 'Gone', path: '/gone', is_available: false },
          { id: 2, label: 'Also Gone', path: '/also-gone', is_available: false },
        ],
        starters: [],
      }),
    };
    const w = mount(ImportSkillsModal, {
      props: { open: true },
      global: { provide: { api: mockApi } },
    });
    await w.find('[data-test="source-local"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-test="saved-paths-select"]').exists()).toBe(false);
  });
});
