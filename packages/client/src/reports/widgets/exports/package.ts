import JSZip from "jszip";
import type { WidgetExportSection } from "./types";
import { sectionToCsv } from "./csv";

function slugifyId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "section";
}

function zipManifestJson(manifest: unknown): string {
  return JSON.stringify(manifest, null, 2);
}

export async function packageSectionsAsCsvBlob(
  sections: WidgetExportSection[],
): Promise<{ blob: Blob; isZip: boolean; filenameBase: string }> {
  if (sections.length === 0) {
    const empty = sectionToCsv({
      id: "empty",
      title: "Empty",
      columns: [{ key: "message", label: "message" }],
      rows: [{ message: "No exportable sections" }],
    });
    const zip = new JSZip();
    // eslint-disable-next-line i18next/no-literal-string
    zip.file("01-empty.csv", empty);
    // eslint-disable-next-line i18next/no-literal-string
    zip.file(
      "manifest.json",
      zipManifestJson(
        {
          sections: [
            { id: "empty", title: "Empty", file: "01-empty.csv", rowCount: 1 },
          ],
        },
      ),
    );
    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, isZip: true, filenameBase: "export" };
  }

  // Always zip CSV exports, even single-section.
  const zip = new JSZip();
  const manifest: { id: string; title: string; file: string; rowCount: number }[] =
    [];
  sections.forEach((s, i) => {
    // eslint-disable-next-line i18next/no-literal-string
    const name = `${String(i + 1).padStart(2, "0")}-${slugifyId(s.id)}.csv`;
    zip.file(name, sectionToCsv(s));
    manifest.push({
      id: s.id,
      title: s.title,
      file: name,
      rowCount: s.rows.length,
    });
  });
  // eslint-disable-next-line i18next/no-literal-string
  zip.file("manifest.json", zipManifestJson({ sections: manifest }));
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, isZip: true, filenameBase: "export" };
}
