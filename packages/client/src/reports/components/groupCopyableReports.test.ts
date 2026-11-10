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

describe("groupCopyableReports", () => {
  const reports = [
    {
      id: 2,
      title: "Offshore report",
      tabs: [
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
      ],
    },
    {
      id: 1,
      title: "Coastal report",
      tabs: [
        {
          id: 10,
          position: 0,
          title: "Only tab",
          cards: [card(101, 0, "Attributes")],
        },
      ],
    },
    {
      id: 3,
      title: "Current report",
      tabs: [
        {
          id: 30,
          position: 0,
          title: "Viability",
          cards: [card(301, 0, "Size")],
        },
      ],
    },
    {
      id: 4,
      title: "   ",
      tabs: [
        {
          id: 40,
          position: 0,
          title: "Notes",
          cards: [],
        },
      ],
    },
    {
      id: 5,
      title: "Unassigned report",
      tabs: [
        {
          id: 50,
          position: 0,
          title: "Overview",
          cards: [card(501, 0, "Summary")],
        },
      ],
    },
  ];

  test("lists every other report under its title and drops the open report", () => {
    const grouped = groupCopyableReports(reports, 3);

    expect(grouped.map((report) => report.reportTitle)).toEqual([
      "Coastal report",
      "Offshore report",
      "Unassigned report",
    ]);
    expect(grouped.map((report) => report.reportId)).toEqual([1, 2, 5]);
    expect(grouped.find((report) => report.reportId === 3)).toBeUndefined();
  });

  test("orders tabs and cards and hides the tab title when a report has one tab", () => {
    const grouped = groupCopyableReports(reports, 3);
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
