import { useTranslation } from "react-i18next";

export type LayerEditorTab = {
  id: string;
  name: string;
  title?: string;
  current: boolean;
};

export default function LayerEditorTabs({
  tabs,
  onSelect,
}: {
  tabs: LayerEditorTab[];
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("admin");

  return (
    <div className="px-3 pb-2.5">
      <nav
        className="grid w-full gap-0.5 rounded-md bg-gray-800/90 p-0.5"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        }}
        aria-label={t("Layer settings sections")}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={tab.current ? "page" : undefined}
            title={tab.title || tab.name}
            className={`min-w-0 truncate rounded px-1 py-1.5 text-center text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
              tab.current
                ? "bg-gray-600 font-semibold text-white shadow-sm ring-1 ring-white/10"
                : "font-medium text-gray-300 hover:bg-gray-700/80 hover:text-white"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
