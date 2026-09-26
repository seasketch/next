import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { MapManagerContext, MapOverlayContext } from "./MapContextManager";
import { SearchResultHighlights } from "../projects/Sketches/TreeItemComponent";
import INaturalistThumbnail from "../components/INaturalistThumbnail/INaturalistThumbnail";
import Spinner from "../components/Spinner";
import { useTranslatedProps } from "../components/TranslatedPropControl";
import {
  compactInaturalistAttribution,
  prefetchInaturalistTaxonPhotos,
  unregisterInaturalistTaxonPhoto,
  useInaturalistTaxonPhoto,
} from "./inaturalistTaxonPhotos";
import { orgQueryHitMatchedAncestor, OrgQueryHit } from "./orgQueryApi";
import {
  EnrichedDataTableEntry,
  TaxonSearchHit,
  highlightQueryTerms,
  taxonHitIsActive,
} from "./overlayTaxonSearch";

const INITIAL_ROWS = 25;

function translateTitle(
  title: string,
  translatedProps: unknown,
  getTranslatedProp: (
    propName: string,
    record: { title: string; translatedProps: unknown }
  ) => string
): string {
  if (!translatedProps || typeof translatedProps !== "object") {
    return title;
  }
  return (
    getTranslatedProp("title", { title, translatedProps }) || title
  );
}

export default function OverlayTaxonSearchResults({
  enabled,
  search,
  hits,
  loading,
  error,
}: {
  enabled: boolean;
  search?: string;
  hits: TaxonSearchHit[];
  loading: boolean;
  error: string | null;
}) {
  const { t } = useTranslation("homepage");
  const query = (search || "").trim();
  const [shown, setShown] = useState(INITIAL_ROWS);
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const getTranslatedProp = useTranslatedProps();

  useEffect(() => {
    setShown(INITIAL_ROWS);
  }, [query]);

  const visible = hits.slice(0, shown);
  const visiblePhotoKey = visible
    .map((row) => row.hit.inatTaxonId)
    .filter((id): id is number => id != null && id > 0)
    .join(",");

  useEffect(() => {
    const ids = visiblePhotoKey
      .split(",")
      .map((part) => Number(part))
      .filter((id) => id > 0);
    if (ids.length === 0) return;
    prefetchInaturalistTaxonPhotos(ids);
    return () => {
      for (const id of ids) {
        unregisterInaturalistTaxonPhoto(id);
      }
    };
  }, [visiblePhotoKey]);

  if (!enabled || query.length < 2) return null;
  if (!loading && !error && hits.length === 0) return null;

  return (
    <section className="mt-3 border-t border-black/10 pt-2">
      <div className="flex items-center gap-2 px-3 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("Species in monitoring data")}
        </h3>
        {hits.length > 0 ? (
          <span className="text-xs tabular-nums text-gray-400">{hits.length}</span>
        ) : null}
        {loading ? <Spinner mini className="opacity-80" /> : null}
      </div>
      {error ? (
        <p className="px-3 py-1 text-xs text-red-600">
          {t("Couldn't load search results")}
        </p>
      ) : null}
      {loading && hits.length === 0 && !error ? (
        <p className="px-3 py-2 text-xs italic text-gray-400">
          {t("Searching…")}
        </p>
      ) : null}
      <div
        ref={setListEl}
        className={clsx(loading && hits.length > 0 && "opacity-60")}
      >
        {visible.map((row) => (
          <TaxonHitRow
            key={`${row.entry.prefix}\0${row.hit.value}`}
            row={row}
            query={query}
            listEl={listEl}
            layerTitle={translateTitle(
              row.entry.layerTitle,
              row.entry.layerTranslatedProps,
              getTranslatedProp
            )}
            folderPath={row.entry.folderPath.map((title, index) =>
              translateTitle(
                title,
                row.entry.folderTranslatedProps[index],
                getTranslatedProp
              )
            )}
          />
        ))}
      </div>
      {hits.length > shown ? (
        <button
          type="button"
          className="mx-3 mb-2 mt-1 text-xs text-primary-600 hover:text-primary-700"
          onClick={() => setShown((count) => count + INITIAL_ROWS)}
        >
          {t("Show more")}
        </button>
      ) : null}
    </section>
  );
}

function TaxonHitRow({
  row,
  query,
  listEl,
  layerTitle,
  folderPath,
}: {
  row: TaxonSearchHit;
  query: string;
  listEl: HTMLDivElement | null;
  layerTitle: string;
  folderPath: string[];
}) {
  const { t } = useTranslation("homepage");
  const { manager } = useContext(MapManagerContext);
  const { layerStatesByTocStaticId } = useContext(MapOverlayContext);
  const { hit, entry } = row;
  const active = taxonHitIsActive(
    layerStatesByTocStaticId[entry.tocStableId],
    entry,
    hit
  );
  const primary = hit.commonName || hit.scientificName || hit.value;
  const showScientific = Boolean(
    hit.scientificName && hit.scientificName !== primary
  );
  const showValue = Boolean(
    hit.value && hit.value !== primary && hit.value !== hit.scientificName
  );
  const marked = highlightQueryTerms(primary, query);
  const folders = folderPath.filter(Boolean);
  const detail = entry.table.description?.trim()
    ? entry.table.description.trim()
    : typeof entry.table.rowCount === "number"
    ? t("{{count}} rows", { count: entry.table.rowCount })
    : "";

  const clear = () => {
    manager?.setLayerDataTable(entry.tocStableId, null);
  };

  const activate = () => {
    const tableStableId = entry.table.stableId;
    if (!tableStableId) return;
    manager?.activateDataTableForTaxon(
      entry.tocStableId,
      tableStableId,
      entry.organismColumn,
      hit.value
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      title={active ? t("Clear data table display") : undefined}
      className={clsx(
        "group flex w-full items-start gap-2 px-3 py-2 text-left cursor-pointer hover:bg-gray-50",
        active && "bg-primary-600/5"
      )}
      onClick={() => {
        if (active) {
          clear();
        } else {
          activate();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (active) {
            clear();
          } else {
            activate();
          }
        }
      }}
    >
      <TaxonThumbnail hit={hit} root={listEl} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug text-gray-800">
          {marked.indexOf("<<<") !== -1 ? (
            <SearchResultHighlights data={marked} />
          ) : (
            primary
          )}
        </div>
        {showScientific || showValue ? (
          <span className="mt-0.5 block truncate text-[11px] leading-snug text-gray-500">
            {showScientific ? (
              <span className="italic">{hit.scientificName}</span>
            ) : null}
            {showScientific && showValue ? (
              // eslint-disable-next-line i18next/no-literal-string
              <span>{" · "}</span>
            ) : null}
            {showValue ? <span className="font-mono">{hit.value}</span> : null}
          </span>
        ) : null}
        {orgQueryHitMatchedAncestor(hit) ? (
          <span className="mt-0.5 block text-[10px] leading-snug text-gray-400">
            {t("Matched a broader group")}
          </span>
        ) : null}
        {layerTitle ? (
          <span className="mt-1 block truncate text-sm font-semibold leading-snug text-gray-900">
            {layerTitle}
          </span>
        ) : null}
        {folders.length > 0 ? (
          <span className="block truncate text-[11px] leading-snug text-gray-500">
            {folders.join(" / ")}
          </span>
        ) : null}
        {entry.table.name || detail ? (
          <span className="block truncate text-[11px] leading-snug text-gray-500">
            {entry.table.name}
            {entry.table.name && detail ? (
              // eslint-disable-next-line i18next/no-literal-string
              <span>{" · "}</span>
            ) : null}
            {detail}
          </span>
        ) : null}
      </div>
      <span className="mt-0.5 w-5 flex-none text-primary-600" aria-hidden>
        {active ? (
          <>
            <CheckIcon className="h-4 w-4 group-hover:hidden" />
            <Cross2Icon className="hidden h-4 w-4 group-hover:block" />
          </>
        ) : null}
      </span>
    </div>
  );
}

function TaxonThumbnail({
  hit,
  root,
}: {
  hit: OrgQueryHit;
  root: HTMLElement | null;
}) {
  const photo = useInaturalistTaxonPhoto(hit.inatTaxonId, false);
  const credit =
    photo.status === "ready"
      ? compactInaturalistAttribution(photo.photo.attribution)
      : "";
  return (
    <span title={credit || undefined} className="flex-none">
      <INaturalistThumbnail sourceId={hit.inatTaxonId} size="sm" root={root} />
    </span>
  );
}
