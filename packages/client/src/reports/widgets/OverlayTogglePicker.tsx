import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import { useOverlaysForReportLayerTogglesQuery } from "../../generated/graphql";

type OverlayTogglePickerProps = {
  onSelect: (
    stableId: string,
    title: string,
    helpers?: {
      apply: (item: any) => void;
      closePopover: () => void;
      focusPalette?: () => void;
    }
  ) => void;
  helpers?: {
    apply: (item: any) => void;
    closePopover: () => void;
    focusPalette?: () => void;
  };
};

export function OverlayTogglePicker({
  onSelect,
  helpers,
}: OverlayTogglePickerProps) {
  const { t } = useTranslation("reports");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const { data, loading, error } = useOverlaysForReportLayerTogglesQuery({
    variables: { slug: getSlug() },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { reportingLayers, allLayers } = useMemo(() => {
    const items =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    const sorted = [...items].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "")
    );
    const reportingLayers = sorted.filter((i) => !!i.reportingOutput);
    return { reportingLayers, allLayers: sorted };
  }, [data]);

  const filterItems = (
    items: typeof reportingLayers
  ): typeof reportingLayers => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => (i.title || "").toLowerCase().includes(term));
  };

  if (loading) {
    return (
      <div className="w-72 rounded-md border border-gray-200 bg-white shadow-xl px-3 py-3 text-sm text-gray-600">
        {t("Loading overlays…")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-72 rounded-md border border-red-200 bg-white shadow-xl px-3 py-3 text-sm text-red-700">
        {error.message}
      </div>
    );
  }

  const filteredReporting = filterItems(reportingLayers);
  const filteredAll = filterItems(allLayers);

  return (
    <div className="w-72 rounded-md border border-gray-200 bg-white shadow-xl">
      <div className="border-b border-gray-100 p-2">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search overlays…")}
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
        />
      </div>
      <div className="max-h-72 overflow-auto">
        <LayerGroup
          title={t("Reporting Layers")}
          items={filteredReporting}
          onSelect={(id, title) => onSelect(id, title, helpers)}
        />
        <LayerGroup
          title={t("All Layers")}
          items={filteredAll}
          onSelect={(id, title) => onSelect(id, title, helpers)}
        />
      </div>
    </div>
  );
}

function LayerGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: { stableId: string; title?: string | null }[];
  onSelect: (stableId: string, title: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="border-b last:border-b-0 border-gray-100">
      <div className="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-gray-500">
        {title}
      </div>
      {items.map((item) => (
        <button
          key={item.stableId}
          className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 text-sm"
          onClick={(e) => {
            e.preventDefault();
            onSelect(item.stableId, item.title || item.stableId);
          }}
        >
          <span className="truncate block text-gray-900 font-medium">
            {item.title || item.stableId}
          </span>
        </button>
      ))}
    </div>
  );
}
