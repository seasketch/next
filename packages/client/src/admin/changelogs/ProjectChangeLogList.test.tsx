/* eslint-disable i18next/no-literal-string */
import { render } from "@testing-library/react";
import { ChangeLogDetailsFragment } from "../../generated/graphql";
import "../../i18n";
import ProjectChangeLogList from "./ProjectChangeLogList";

const MEASURED_ROW_HEIGHT = 160;

function changeLog(id: number): ChangeLogDetailsFragment {
  return { id } as ChangeLogDetailsFragment;
}

function list(ids: number[]) {
  return (
    <div style={{ height: 800, width: 640 }}>
      <ProjectChangeLogList
        dayGroups={[
          {
            key: "today",
            date: new Date("2026-11-04T20:00:00Z"),
            changeLogs: ids.map(changeLog),
          },
        ]}
        formatDay={() => "Today"}
        renderEntry={(entry) => <div>Entry {entry.id}</div>}
        hasNextPage={ids.length < 3}
        loadingMore={false}
        onLoadMore={() => undefined}
        entryCount={ids.length}
        beginningMessage="Beginning of the changelog"
      />
    </div>
  );
}

function rowBoxes() {
  const list = document.querySelector("[data-changelog-list]");
  const inner = list?.firstElementChild;
  return Array.from(inner?.children ?? []).map((node) => {
    const element = node as HTMLElement;
    return {
      top: Number.parseFloat(element.style.top),
      height: Number.parseFloat(element.style.height),
    };
  });
}

describe("ProjectChangeLogList", () => {
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight"
  );
  const originalRect = Element.prototype.getBoundingClientRect;

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return MEASURED_ROW_HEIGHT;
      },
    });
    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 800,
        right: 640,
        width: 640,
        height: 800,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
  });

  afterAll(() => {
    if (originalOffsetHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetHeight",
        originalOffsetHeight
      );
    }
    Element.prototype.getBoundingClientRect = originalRect;
  });

  test("positions rows from measured heights on the first paint", () => {
    render(list([1, 2]));

    const boxes = rowBoxes();
    expect(boxes.length).toBeGreaterThan(1);
    // Header, two entries, and the footer. Estimates (40/88/72) leave the
    // second entry overlapping the first. Measured rows stack at 160px.
    expect(boxes.map((box) => box.height)).toEqual([
      MEASURED_ROW_HEIGHT,
      MEASURED_ROW_HEIGHT,
      MEASURED_ROW_HEIGHT,
      MEASURED_ROW_HEIGHT,
    ]);
    expect(boxes.map((box) => box.top)).toEqual([
      0,
      MEASURED_ROW_HEIGHT,
      MEASURED_ROW_HEIGHT * 2,
      MEASURED_ROW_HEIGHT * 3,
    ]);
  });

  test("keeps measured positions when an older page is appended", () => {
    const view = render(list([1, 2]));
    view.rerender(list([1, 2, 3]));

    const boxes = rowBoxes();
    expect(boxes).toHaveLength(5);
    expect(boxes.map((box) => box.top)).toEqual([
      0,
      MEASURED_ROW_HEIGHT,
      MEASURED_ROW_HEIGHT * 2,
      MEASURED_ROW_HEIGHT * 3,
      MEASURED_ROW_HEIGHT * 4,
    ]);
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index].top).toBeGreaterThanOrEqual(
        boxes[index - 1].top + boxes[index - 1].height
      );
    }
  });
});
