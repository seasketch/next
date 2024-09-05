import { describe, it, expect, beforeAll } from "vitest";
// @ts-ignore
import fs from "fs";
// @ts-ignore
import path from "path";
import {
  fgdcToMarkdown,
  getAttribution as getFGDCAttribution,
} from "../src/fgdcToMarkdown";
import {
  iso19139ToMarkdown,
  getAttribution as getIsoAttribution,
} from "../src/iso19139";
// @ts-ignore
import xml2js from "xml2js";

// Helper to load XML files
function loadXml(filePath: string) {
  const xml = fs.readFileSync(filePath, "utf8");
  return xml2js.parseStringPromise(xml);
}

// Helper to write Markdown files
function writeMarkdownFile(fileName: string, markdown: string) {
  const outputPath = path.resolve(__dirname, "output", fileName);
  fs.writeFileSync(outputPath, markdown, "utf8");
}

describe("Metadata Parsers", () => {
  describe("FGDC Metadata", () => {
    let fgdcMetadata: any;

    beforeAll(async () => {
      const filePath = path.resolve(
        __dirname,
        "./Coral-fgdc-example-metadata.xml"
      );
      fgdcMetadata = await loadXml(filePath);
    });

    it("parses fgdc metadata to Markdown", () => {
      expect(fgdcMetadata).toBeTruthy();
      const markdown = fgdcToMarkdown(fgdcMetadata);
      // Write the markdown file
      writeMarkdownFile("Coral-fgcd-metadata.md", markdown);

      expect(markdown).toContain("# Resilience Metrics from FRRP Coral Data");
      expect(markdown).toContain(
        "**Abstract:** The dataset includes Taxonomic richness"
      );
      expect(markdown).toContain("**Purpose:** This dataset was compiled to");
      expect(markdown).toContain(
        "**Keywords:** Florida Reef Resiliency Program, The Nature Conservancy"
      );
      expect(markdown).toContain("## Contact Information");
      expect(markdown).toContain("- **Organization:** The Nature Conservancy");
    });

    it("returns the correct FGDC attribution", () => {
      const attribution = getFGDCAttribution(fgdcMetadata);
      expect(attribution).toBe("The Nature Conservancy");
    });
  });

  describe("ISO 19139 Metadata", () => {
    let isoMetadata: any;

    beforeAll(async () => {
      const filePath = path.resolve(
        __dirname,
        "./3nm_Polyline-iso-metadata.xml"
      );
      isoMetadata = await loadXml(filePath);
    });

    it("parses ISO 19139 metadata to Markdown", () => {
      const markdown = iso19139ToMarkdown(isoMetadata);
      // Write the markdown file
      writeMarkdownFile("3nm_Polyline-iso-metadata.md", markdown);
      expect(markdown).toContain("# 3nm_Polyline");
      expect(markdown).toContain(
        "**Abstract:** This is a 3nm demarcation within the Polyline for Kiribati"
      );
      expect(markdown).toContain("**Keywords:** FAUNA, FISHERIES");
      expect(markdown).toContain("## Contact Information");
      expect(markdown).toContain("- **Organization:** Geoscience_MFMRD");
      expect(markdown).toContain("**Name:** Catherine Paul");
    });

    it("returns the correct ISO attribution", () => {
      const attribution = getIsoAttribution(isoMetadata);
      expect(attribution).toBe("Geoscience_MFMRD");
    });
  });
});
