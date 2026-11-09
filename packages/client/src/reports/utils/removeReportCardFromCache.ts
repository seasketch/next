import { ApolloCache, InMemoryCache } from "@apollo/client";

/**
 * Drop a deleted report card from the normalized cache.
 *
 * `deleteReportCard` returns only a boolean, so Apollo cannot tell which
 * `ReportTab.cards` entry to remove. The authoring UI reads
 * `BaseReportContext` by report id. Refetching `DraftReport` (the sketch
 * class's primary draft) updates a different Report when the open draft is a
 * duplicate or any other unassigned report, and the card stays on screen
 * until a full reload.
 */
export function removeReportCardFromCache(
  cache: ApolloCache<unknown>,
  cardId: number,
  reportId: number
) {
  const reportCacheId = cache.identify({
    __typename: "Report",
    id: reportId,
  });

  const tabIds: number[] = [];
  if (reportCacheId) {
    cache.modify({
      id: reportCacheId,
      fields: {
        tabs(existing, { readField }) {
          const refs = Array.isArray(existing) ? existing : [];
          for (const ref of refs) {
            const id = readField("id", ref);
            if (typeof id === "number") {
              tabIds.push(id);
            }
          }
          return existing;
        },
        updatedAt() {
          return new Date().toISOString();
        },
      },
    });
  }

  let removed = false;
  const stripCard = (tabCacheId: string) => {
    cache.modify({
      id: tabCacheId,
      fields: {
        cards(existing, { readField }) {
          const refs = Array.isArray(existing) ? existing : [];
          const next = refs.filter((ref) => readField("id", ref) !== cardId);
          if (next.length === refs.length) {
            return existing;
          }
          removed = true;
          return next;
        },
      },
    });
  };

  for (const tabId of tabIds) {
    const tabCacheId = cache.identify({
      __typename: "ReportTab",
      id: tabId,
    });
    if (tabCacheId) {
      stripCard(tabCacheId);
    }
  }

  // The card can also sit on a tab that is only reachable from another
  // cached report (for example the sketch-class DraftReport query).
  if (!removed && cache instanceof InMemoryCache) {
    for (const [id, entity] of Object.entries(cache.extract())) {
      if (
        !entity ||
        typeof entity !== "object" ||
        (entity as { __typename?: string }).__typename !== "ReportTab"
      ) {
        continue;
      }
      stripCard(id);
    }
  }

  const cardCacheId = cache.identify({
    __typename: "ReportCard",
    id: cardId,
  });
  if (cardCacheId) {
    cache.evict({ id: cardCacheId });
    cache.gc();
  }
}
