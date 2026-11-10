import { groupCopyableReports } from "./CopyCardsFromReportPopover";

function card(id: number, position: number, title: string) {
  return {
    id,
    position,
    title,
    body: null,
    componentSettings: null,
    alternateLanguageSettings: null,
  };
}

function report(
  id: number,
  title: string,
  tabs: Array<{
    id: number;
    position: number;
    title: string;
    cards: ReturnType<typeof card>[];
  }>,
  extras?: { projectId?: number; draftId?: number | null }
) {
  return {
    id,
    title,
    projectId: extras?.projectId ?? 7,
    draftId: extras?.draftId ?? null,
    tabs,
  };
}

describe("groupCopyableReports", () => {
  const reports = [
    report(2, "Offshore report", [
      {
        id: 20,
        position: 1,
        title: "Representation",
        cards: [card(202, 1, "Reef"), card(201, 0, "Geomorphology")],
      },
      {
        id: 21,
        position: 0,
        title: "Viability",
        cards: [card(210, 0, "Size")],
      },
      {
        id: 22,
        position: 2,
        title: "Empty",
        cards: [],
      },
    ]),
    report(1, "Coastal report", [
      {
        id: 10,
        position: 0,
        title: "Only tab",
        cards: [card(101, 0, "Attributes")],
      },
    ]),
    report(3, "Current report", [
      {
        id: 30,
        position: 0,
        title: "Viability",
        cards: [card(301, 0, "Size")],
      },
    ]),
    report(4, "   ", [
      {
        id: 40,
        position: 0,
        title: "Notes",
        cards: [],
      },
    ]),
    report(5, "Unassigned report", [
      {
        id: 50,
        position: 0,
        title: "Overview",
        cards: [card(501, 0, "Summary")],
      },
    ]),
    report(
      6,
      "Published snapshot",
      [
        {
          id: 60,
          position: 0,
          title: "Viability",
          cards: [card(601, 0, "Old size")],
        },
      ],
      { draftId: 2 }
    ),
    report(
      8,
      "Other project",
      [
        {
          id: 80,
          position: 0,
          title: "Overview",
          cards: [card(801, 0, "Elsewhere")],
        },
      ],
      { projectId: 99 }
    ),
  ];

  test("lists every other draft in this project under its title", () => {
    const grouped = groupCopyableReports(reports, 3, 7);

    expect(grouped.map((item) => item.reportTitle)).toEqual([
      "Coastal report",
      "Offshore report",
      "Unassigned report",
    ]);
    expect(grouped.map((item) => item.reportId)).toEqual([1, 2, 5]);
    expect(grouped.find((item) => item.reportId === 3)).toBeUndefined();
    expect(grouped.find((item) => item.reportId === 6)).toBeUndefined();
    expect(grouped.find((item) => item.reportId === 8)).toBeUndefined();
  });

  test("orders tabs and cards and hides the tab title when a report has one tab", () => {
    const grouped = groupCopyableReports(reports, 3, 7);
    const coastal = grouped.find((report) => report.reportId === 1);
    const offshore = grouped.find((report) => report.reportId === 2);

    expect(coastal?.hideTabTitles).toBe(true);
    expect(coastal?.tabs.map((tab) => tab.tabTitle)).toEqual(["Only tab"]);

    expect(offshore?.hideTabTitles).toBe(false);
    expect(offshore?.tabs.map((tab) => tab.tabTitle)).toEqual([
      "Viability",
      "Representation",
    ]);
    expect(offshore?.tabs[1].cards.map((item) => item.title)).toEqual([
      "Geomorphology",
      "Reef",
    ]);
  });
});
