import { describe, expect, it, vi } from "vitest";
import { createNewspaperDemo, executeNewspaperDemo } from "./newspaperDemo";
import { buildPortableNewspaper, newspaperMarkdown } from "./newspaperExport";

describe("portable newspaper exports", () => {
  it("includes hidden original text and verbatim supplements by default", () => {
    const report =
      createNewspaperDemo(new Date("2026-09-28T12:00:00Z")).reports[0];
    report.hidden_sections = ["thoughts"];
    report.supplements.push({
      id: "s",
      report_date: report.date,
      body: "  保留\n全部原文  ",
      occurred_at: null,
      created_at: "now",
      updated_at: "now",
    });
    const markdown = newspaperMarkdown(report);
    expect(markdown).toContain(
      report.snapshot.sections.find((s) => s.id === "thoughts")!.items[0].body,
    );
    expect(markdown).toContain("  保留\n全部原文  ");
  });
  it("builds a ZIP containing Markdown without external image links", async () => {
    const report =
      createNewspaperDemo(new Date("2026-09-28T12:00:00Z")).reports[0];
    const bytes = await buildPortableNewspaper(report);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(bytes)).toContain("newspaper.md");
  });
  it("stores actual image bytes with relative references in the portable bundle", async () => {
    const state = createNewspaperDemo(new Date("2026-09-28T12:00:00Z"));
    const report = executeNewspaperDemo(state, "image_generate", {
      date: state.reports[0].date,
    }).state.reports[0];
    report.assets[0].url = "https://private.example/image?expires=123";
    const image = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => image.buffer,
    });
    const zip = await buildPortableNewspaper(report, {}, fetcher);
    const files: Record<string, Uint8Array> = {};
    const view = new DataView(zip.buffer);
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const length = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const name = new TextDecoder().decode(
        zip.slice(offset + 30, offset + 30 + nameLength),
      );
      const start = offset + 30 + nameLength;
      files[name] = zip.slice(start, start + length);
      offset = start + length;
    }
    expect(files["images/01-main.png"]).toEqual(image);
    expect(new TextDecoder().decode(files["newspaper.md"])).toContain(
      "(images/01-main.png)",
    );
    expect(new TextDecoder().decode(files["newspaper.md"])).not.toContain(
      "expires=",
    );
  });
  it("does not return an incomplete bundle when an image cannot be downloaded", async () => {
    const state = createNewspaperDemo(new Date("2026-09-28T12:00:00Z"));
    const report = executeNewspaperDemo(state, "image_generate", {
      date: state.reports[0].date,
    }).state.reports[0];
    await expect(
      buildPortableNewspaper(
        report,
        {},
        vi.fn().mockResolvedValue({ ok: false }),
      ),
    ).rejects.toThrow("配图下载失败");
  });
});
