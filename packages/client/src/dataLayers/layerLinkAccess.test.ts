import { describe, expect, it } from "@jest/globals";
import {
  isLayerLinkSharing,
  layerLinkNotices,
  layerLinkPath,
} from "./layerLinkAccess";

const openSummary = {
  projectName: "Great Bear Sea",
  projectAccess: "public" as const,
  title: "Rockfish",
  attribution: "DFO",
  folderTitles: ["Species"],
  restrictions: [],
};

describe("isLayerLinkSharing", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isLayerLinkSharing(null)).toBe(false);
    expect(isLayerLinkSharing(undefined)).toBe(false);
    expect(isLayerLinkSharing("public")).toBe(false);
    expect(isLayerLinkSharing([])).toBe(false);
  });

  it("accepts a complete summary", () => {
    expect(isLayerLinkSharing(openSummary)).toBe(true);
    expect(
      isLayerLinkSharing({
        ...openSummary,
        attribution: null,
        restrictions: [
          {
            title: "Species",
            isFolder: true,
            type: "group",
            groups: ["Planners"],
          },
        ],
      })
    ).toBe(true);
  });

  it("rejects a restriction with the wrong shape", () => {
    expect(
      isLayerLinkSharing({
        ...openSummary,
        restrictions: [{ title: "Species" }],
      })
    ).toBe(false);
  });
});

describe("layerLinkNotices", () => {
  it("describes a public project and a public layer as open", () => {
    expect(layerLinkNotices(openSummary)).toEqual({
      tone: "open",
      blocks: [{ kind: "fullyOpen" }],
    });
  });

  it("describes an invite-only project", () => {
    const notices = layerLinkNotices({
      ...openSummary,
      projectAccess: "invite_only",
    });
    expect(notices.tone).toBe("restricted");
    expect(notices.blocks).toEqual([
      { kind: "projectInvite", projectName: "Great Bear Sea" },
    ]);
  });

  it("lists folder and layer restrictions after the project gate", () => {
    const notices = layerLinkNotices({
      ...openSummary,
      projectAccess: "admins_only",
      restrictions: [
        {
          title: "Species",
          isFolder: true,
          type: "group",
          groups: ["Planners", "Science"],
        },
        {
          title: "Rockfish",
          isFolder: false,
          type: "admins_only",
          groups: [],
        },
      ],
    });
    expect(notices.blocks.map((block) => block.kind)).toEqual([
      "projectAdmins",
      "groups",
      "adminsOnly",
    ]);
  });
});

describe("layerLinkPath", () => {
  it("builds the project layer route", () => {
    expect(layerLinkPath("great-bear", "11111111-2222-3333-4444-555555555555")).toBe(
      "/great-bear/layers/11111111-2222-3333-4444-555555555555"
    );
  });
});
