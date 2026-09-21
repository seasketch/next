/* eslint-disable i18next/no-literal-string */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import OrganismSelector from "./OrganismSelector";
import { DataTableFilter } from "./dataTableQueryApi";
import {
  OrgQueryHit,
  clearOrganismCatalogCache,
  fetchOrganismCatalog,
} from "./orgQueryApi";

const ORG_QUERY_URL = "https://uploads.seasketch.org/orgQuery?tables=a";

const classcodeColumn: GeostatsAttribute = {
  attribute: "classcode",
  type: "string",
  count: 3,
  values: {
    SCBC: 1,
    SATR: 2,
    SCAR: 3,
  },
};

function hit(
  partial: Partial<OrgQueryHit> & Pick<OrgQueryHit, "value">
): OrgQueryHit {
  return {
    table:
      "projects/ca/public/11111111-1111-1111-1111-111111111111/dataTables/u1",
    column: "classcode",
    scientificName: null,
    commonName: partial.value,
    description: null,
    inatTaxonId: null,
    wormsAphiaId: null,
    score: 1,
    matchedFields: ["common_name"],
    ...partial,
  };
}

const cabezon = hit({
  value: "SCBC",
  commonName: "Cabezon",
  scientificName: "Scorpaenichthys marmoratus",
});
const kelpRockfish = hit({
  value: "SATR",
  commonName: "Kelp Rockfish",
  scientificName: "Sebastes atrovirens",
});
const gopherRockfish = hit({
  value: "SCAR",
  commonName: "Gopher Rockfish",
  scientificName: "Sebastes carnatus",
});

function mockOrgQueryFetch(searchHits: Record<string, OrgQueryHit[]>) {
  const catalogHits = [cabezon, kelpRockfish, gopherRockfish];
  global.fetch = jest.fn(async (input: RequestInfo) => {
    const url = new URL(String(input));
    const q = url.searchParams.get("q") || "";
    return {
      ok: true,
      json: async () => ({
        q,
        tablesScanned: 1,
        hits: q ? searchHits[q] || [] : catalogHits,
      }),
    } as Response;
  }) as typeof fetch;
}

function renderSelector(filters: DataTableFilter[]) {
  const onChange = jest.fn();
  render(
    <OrganismSelector
      column={classcodeColumn}
      filters={filters}
      orgQueryUrl={ORG_QUERY_URL}
      onChange={onChange}
    />
  );
  return onChange;
}

describe("OrganismSelector select all results", () => {
  afterEach(() => {
    clearOrganismCatalogCache();
    jest.restoreAllMocks();
  });

  it("replaces the current selection with every search hit", async () => {
    mockOrgQueryFetch({
      rockfish: [kelpRockfish, gopherRockfish],
    });
    await fetchOrganismCatalog(ORG_QUERY_URL);

    const onChange = renderSelector([
      { column: "classcode", op: "eq", value: "SCBC" },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Cabezon/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "rockfish" },
    });

    const selectAll = await waitFor(() =>
      screen.getByRole("button", { name: "Select all {{count}} results" })
    );
    fireEvent.click(selectAll);

    expect(onChange).toHaveBeenLastCalledWith([
      { column: "classcode", op: "in", values: ["SATR", "SCAR"] },
    ]);
  });

  it("does not offer select-all for the unfiltered catalog", async () => {
    mockOrgQueryFetch({});
    await fetchOrganismCatalog(ORG_QUERY_URL);

    renderSelector([]);

    fireEvent.click(screen.getByRole("button", { name: /No selection/i }));
    expect(screen.getByRole("button", { name: "Select all" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Select all {{count}} results" })
    ).toBeNull();
  });
});

describe("OrganismSelector placement", () => {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  afterEach(() => {
    clearOrganismCatalogCache();
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    jest.restoreAllMocks();
  });

  it("opens on the side that stays inside the viewport, centered on the trigger", async () => {
    mockOrgQueryFetch({});
    await fetchOrganismCatalog(ORG_QUERY_URL);
    document.documentElement.style.fontSize = "16px";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLButtonElement) {
        return {
          top: 400,
          left: 1100,
          right: 1400,
          bottom: 448,
          width: 300,
          height: 48,
          x: 1100,
          y: 400,
          toJSON() {
            return {};
          },
        } as DOMRect;
      }
      return {
        top: 0,
        left: 0,
        right: 416,
        bottom: 480,
        width: 416,
        height: 480,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };

    renderSelector([]);
    fireEvent.click(screen.getByRole("button", { name: /No selection/i }));

    const panel = document.querySelector("[data-side]");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("data-side")).toBe("left");
    expect((panel as HTMLElement).style.left).toBe("678px");
    expect((panel as HTMLElement).style.top).toBe("184px");
  });
});
