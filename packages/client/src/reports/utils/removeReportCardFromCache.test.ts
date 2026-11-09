import { gql, InMemoryCache } from "@apollo/client";
import { removeReportCardFromCache } from "./removeReportCardFromCache";

const ReportCards = gql`
  query ReportCardsForCacheTest($reportId: Int!) {
    report(id: $reportId) {
      id
      updatedAt
      tabs {
        id
        cards {
          id
          position
        }
      }
    }
  }
`;

function seedCache() {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: ReportCards,
    variables: { reportId: 3 },
    data: {
      report: {
        __typename: "Report",
        id: 3,
        updatedAt: "2020-01-01T00:00:00.000Z",
        tabs: [
          {
            __typename: "ReportTab",
            id: 1,
            cards: [
              { __typename: "ReportCard", id: 10, position: 1 },
              { __typename: "ReportCard", id: 11, position: 2 },
            ],
          },
          {
            __typename: "ReportTab",
            id: 2,
            cards: [{ __typename: "ReportCard", id: 12, position: 1 }],
          },
        ],
      },
    },
  });
  cache.writeQuery({
    query: ReportCards,
    variables: { reportId: 9 },
    data: {
      report: {
        __typename: "Report",
        id: 9,
        updatedAt: "2020-01-01T00:00:00.000Z",
        tabs: [
          {
            __typename: "ReportTab",
            id: 8,
            cards: [{ __typename: "ReportCard", id: 80, position: 1 }],
          },
        ],
      },
    },
  });
  return cache;
}

function readReport(cache: InMemoryCache, reportId: number) {
  return cache.readQuery<{
    report: {
      updatedAt: string;
      tabs: { id: number; cards: { id: number }[] }[];
    };
  }>({
    query: ReportCards,
    variables: { reportId },
  });
}

describe("removeReportCardFromCache", () => {
  it("removes the card from its tab and evicts the entity", () => {
    const cache = seedCache();
    removeReportCardFromCache(cache, 10, 3);

    const report = readReport(cache, 3);
    expect(report?.report.tabs[0].cards.map((card) => card.id)).toEqual([11]);
    expect(report?.report.tabs[1].cards.map((card) => card.id)).toEqual([12]);
    expect(cache.extract()["ReportCard:10"]).toBeUndefined();
    expect(new Date(report!.report.updatedAt).getTime()).toBeGreaterThan(
      new Date("2020-01-01T00:00:00.000Z").getTime()
    );

    const other = readReport(cache, 9);
    expect(other?.report.tabs[0].cards.map((card) => card.id)).toEqual([80]);
    expect(other?.report.updatedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("still strips the card when it is only cached on another report", () => {
    const cache = seedCache();
    removeReportCardFromCache(cache, 80, 3);

    expect(readReport(cache, 9)?.report.tabs[0].cards).toEqual([]);
    expect(cache.extract()["ReportCard:80"]).toBeUndefined();
    expect(readReport(cache, 3)?.report.tabs[0].cards.map((card) => card.id)).toEqual([
      10, 11,
    ]);
  });
});
