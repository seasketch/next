/* eslint-disable i18next/no-literal-string */
import {
  ChangeLogDetailsFragment,
  ChangeLogFieldGroup,
} from "../../generated/graphql";
import {
  summarizedChangeCountLabel,
  summarizedRecencyLabel,
} from "./PublishSummarizedChangesPanel";
import { draftChangesSinceDate } from "./SelectivePublishModal";
import {
  alignPublishSummaryWithPendingItems,
  buildPublishChangeSummary,
} from "./publishChangelogSummary";

function log(
  overrides: Partial<ChangeLogDetailsFragment> &
    Pick<ChangeLogDetailsFragment, "id" | "entityId" | "fieldGroup">
): ChangeLogDetailsFragment {
  return {
    entityType: "table_of_contents_items",
    meta: null,
    startedAt: "2026-11-10T20:00:00.000Z",
    lastAt: "2026-11-10T20:00:00.000Z",
    saveCount: 1,
    fromSummary: {},
    toSummary: {},
    fullOverlayPublish: null,
    publishedOverlayItems: [],
    editorCanonicalEmail: null,
    editorProfile: null,
    ...overrides,
  } as ChangeLogDetailsFragment;
}

const publishedAt = "2026-11-01T00:00:00.000Z";

describe("alignPublishSummaryWithPendingItems", () => {
  it("drops changelog rows that no longer differ from the published copy", () => {
    const summary = buildPublishChangeSummary({
      changeLogs: [
        log({
          id: "1",
          entityId: 1,
          fieldGroup: ChangeLogFieldGroup.LayerTitle,
        }),
        log({
          id: "2",
          entityId: 2,
          fieldGroup: ChangeLogFieldGroup.LayerTitle,
        }),
      ],
      draftItems: [
        { id: 1, title: "Kiribati EEZ", isFolder: false },
        { id: 2, title: "High Seas", isFolder: false },
      ],
      tableOfContentsLastPublished: publishedAt,
    });

    const aligned = alignPublishSummaryWithPendingItems(summary, [
      {
        stableId: "high-seas",
        kind: "updated",
        title: "High Seas",
        isFolder: false,
        draftId: 2,
      },
    ]);

    expect(aligned.updated.map((row) => row.title)).toEqual(["High Seas"]);
    expect(aligned.updated[0].changeCount).toBe(1);
    expect(aligned.added).toEqual([]);
    expect(aligned.removed).toEqual([]);
  });

  it("lists a pending diff that the changelog does not describe", () => {
    const summary = buildPublishChangeSummary({
      changeLogs: [],
      draftItems: [],
      tableOfContentsLastPublished: publishedAt,
    });

    const aligned = alignPublishSummaryWithPendingItems(summary, [
      {
        stableId: "quiet",
        kind: "updated",
        title: "Quiet layer",
        isFolder: false,
        draftId: 9,
      },
    ]);

    expect(aligned.updated).toEqual([
      expect.objectContaining({
        title: "Quiet layer",
        stableId: "quiet",
        changeCount: 0,
        badges: [],
        logs: [],
      }),
    ]);
  });

  it("keeps a removed item only when it is still unpublished", () => {
    const summary = buildPublishChangeSummary({
      changeLogs: [
        log({
          id: "deleted",
          entityId: 5,
          fieldGroup: ChangeLogFieldGroup.LayerDeleted,
          fromSummary: { title: "Smoke", is_folder: false },
        }),
      ],
      draftItems: [],
      tableOfContentsLastPublished: publishedAt,
    });

    expect(
      alignPublishSummaryWithPendingItems(summary, []).removed
    ).toEqual([]);

    const aligned = alignPublishSummaryWithPendingItems(summary, [
      {
        stableId: "smoke",
        kind: "removed",
        title: "Smoke",
        isFolder: false,
        draftId: null,
      },
    ]);
    expect(aligned.removed.map((row) => row.stableId)).toEqual(["smoke"]);
    expect(aligned.removed[0].changeCount).toBe(1);
  });

  it("leaves z-order on the summary when no overlay rows are pending", () => {
    const summary = buildPublishChangeSummary({
      changeLogs: [
        log({
          id: "z",
          entityId: 1,
          entityType: "projects",
          fieldGroup: ChangeLogFieldGroup.LayersZOrderChange,
        }),
      ],
      draftItems: [],
      tableOfContentsLastPublished: publishedAt,
    });

    const aligned = alignPublishSummaryWithPendingItems(summary, []);
    expect(aligned.zOrderSummary?.changeCount).toBe(1);
    expect(aligned.added).toEqual([]);
    expect(aligned.updated).toEqual([]);
    expect(aligned.removed).toEqual([]);
  });
});

describe("publish summary copy", () => {
  const t = (key: string) => key;

  it("uses the singular for one change", () => {
    expect(summarizedChangeCountLabel(1, t)).toBe("1 change");
    expect(summarizedChangeCountLabel(2, t)).toBe("{{count}} changes");
  });

  it("does not prefix a sub-minute edit with last", () => {
    const now = Date.parse("2026-11-10T20:00:30.000Z");
    expect(
      summarizedRecencyLabel("2026-11-10T20:00:00.000Z", t, now)
    ).toBe("just now");
    expect(
      summarizedRecencyLabel("2026-11-10T18:00:00.000Z", t, now)
    ).toBe("last {{time}}");
  });

  it("includes the time for a publish within 48 hours and omits it after that", () => {
    const lastPublished = new Date("2026-11-10T15:08:00.000Z");
    const recent = lastPublished.getTime() + 3 * 60 * 60 * 1000;
    const older = lastPublished.getTime() + 49 * 60 * 60 * 1000;
    expect(draftChangesSinceDate(lastPublished, recent)).toBe(
      lastPublished.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );
    expect(draftChangesSinceDate(lastPublished, older)).toBe(
      lastPublished.toLocaleDateString(undefined, { dateStyle: "medium" })
    );
  });
});
