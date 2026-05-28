import { describe, it, expect } from "vitest"
import { parseFrontMatter } from "../parseFrontMatter"

describe("parseFrontMatter", () => {
  it("returns null when there is no front matter", () => {
    expect(parseFrontMatter("# Just markdown\nNo front matter")).toBeNull()
  })

  it("returns null when front matter is not at the very top", () => {
    expect(parseFrontMatter("# Heading\n---\nname: test\n---")).toBeNull()
  })

  it("extracts name and description", () => {
    const content = "---\nname: my-skill\ndescription: Does something useful.\n---\n# Body"
    const result = parseFrontMatter(content)
    expect(result.name).toBe("my-skill")
    expect(result.description).toBe("Does something useful.")
  })

  it("extracts version, author, and license", () => {
    const content = "---\nname: test\nversion: 1.2.3\nauthor: Jane\nlicense: MIT\n---"
    const result = parseFrontMatter(content)
    expect(result.version).toBe("1.2.3")
    expect(result.author).toBe("Jane")
    expect(result.license).toBe("MIT")
  })

  it("extracts tags from metadata.hermes.tags nested format", () => {
    const content = "---\nname: arxiv\nversion: 1.0.0\nauthor: Hermes Agent\nlicense: MIT\nmetadata:\n  hermes:\n    tags: [Research, Arxiv, Papers]\n    related_skills: [ocr-and-documents]\n---"
    const result = parseFrontMatter(content)
    expect(result.tags).toEqual(["Research", "Arxiv", "Papers"])
  })

  it("extracts related_skills", () => {
    const content = "---\nname: arxiv\nmetadata:\n  hermes:\n    tags: [Research]\n    related_skills: [ocr-and-documents]\n---"
    const result = parseFrontMatter(content)
    expect(result.related_skills).toEqual(["ocr-and-documents"])
  })

  it("extracts root-level tags array", () => {
    const content = "---\nname: test\ntags: [a, b, c]\n---"
    const result = parseFrontMatter(content)
    expect(result.tags).toEqual(["a", "b", "c"])
  })

  it("returns null when front matter block is empty", () => {
    expect(parseFrontMatter("---\n---\n# Body")).toBeNull()
  })

  it("handles files with only name and description (no version/tags)", () => {
    const content = "---\nname: finmind\ndescription: FinMind financial data query assistant.\n---"
    const result = parseFrontMatter(content)
    expect(result.name).toBe("finmind")
    expect(result.description).toBe("FinMind financial data query assistant.")
    expect(result.version).toBeUndefined()
    expect(result.tags).toBeUndefined()
  })
})
