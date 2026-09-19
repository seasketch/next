import {
  ChevronDownIcon,
  ChevronUpIcon,
  PauseIcon,
} from "@heroicons/react/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import useDialog from "../../components/useDialog";
import {
  DraftTocItemForPublishSummary,
  PublishBadgeKey,
} from "./publishChangelogSummary";
import { PublishBadge } from "./PublishSummarizedChangesPanel";
import LayerMetadataRevisionModal from "./LayerMetadataRevisionModal";
import LayerCartographyRevisionModal from "./LayerCartographyRevisionModal";

const initialPausedLayers = [
  {
    title: "Mangrove Planting",
    badges: ["cartography", "metadata"] as PublishBadgeKey[],
    pausedBy: "Chad Burt",
  },
  {
    title: "Inshore Boundary",
    badges: ["interactivity"] as PublishBadgeKey[],
    pausedBy: "Sina T.",
  },
];

export const MOCK_SELECTIVE_PUBLISHING = true;

export default function MockPausedLayersNotice({
  draftItems,
}: {
  draftItems: DraftTocItemForPublishSummary[];
}) {
  const { t } = useTranslation("admin:data");
  const { confirm } = useDialog();
  const [expanded, setExpanded] = useState(true);
  const [pausedLayers, setPausedLayers] = useState(initialPausedLayers);
  const [metadataModal, setMetadataModal] = useState<number | null>(null);
  const [cartographyModal, setCartographyModal] = useState<number | null>(null);

  const resumePublishing = async (layer: (typeof pausedLayers)[number]) => {
    const confirmed = await confirm(
      t("Resume publishing for {{name}}?", { name: layer.title }),
      {
        description: (
          <Trans ns="admin:data">
            Draft changes to this layer will be included in this publication.
            Future changes may also be included in full overlay list
            publications.
          </Trans>
        ),
        primaryButtonText: t("Resume publishing"),
        secondaryButtonText: t("Keep paused"),
      }
    );
    if (confirmed) {
      setPausedLayers((layers) =>
        layers.filter((candidate) => candidate.title !== layer.title)
      );
    }
  };

  if (pausedLayers.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
        <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <PauseIcon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-amber-950">
            {pausedLayers.length === 1
              ? t("1 paused layer will not be published")
              : t("{{count}} paused layers will not be published", {
                  count: pausedLayers.length,
                })}
          </span>
          <span className="mt-1 block text-sm leading-5 text-amber-800">
            <Trans ns="admin:data">
              Existing public versions of these layers will remain unchanged
              while publication is paused.
            </Trans>
          </span>
        </span>
        {expanded ? (
          <ChevronUpIcon
            className="mt-1 h-4 w-4 flex-none text-amber-700"
            aria-hidden
          />
        ) : (
          <ChevronDownIcon
            className="mt-1 h-4 w-4 flex-none text-amber-700"
            aria-hidden
          />
        )}
      </button>
        {expanded && (
          <div className="border-t border-amber-200 bg-white">
          {pausedLayers.map((layer, index) => {
            const draftItem = draftItems.find(
              (item) => item.title === layer.title
            );
            return (
              <div
                key={layer.title}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <Tooltip.Provider delayDuration={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        type="button"
                        onClick={() => void resumePublishing(layer)}
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                        aria-label={t("Resume publishing for {{name}}", {
                          name: layer.title,
                        })}
                      >
                        <PauseIcon className="h-4 w-4" aria-hidden />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="left"
                        sideOffset={6}
                        className="z-[100] select-none rounded bg-black px-2.5 py-1.5 text-xs text-white shadow-md"
                      >
                        {t("Resume publishing for this layer")}
                        <Tooltip.Arrow className="fill-black" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {layer.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    <Trans ns="admin:data">
                      Paused by {{ name: layer.pausedBy }}
                    </Trans>
                  </p>
                </div>
                {draftItem && (
                  <Tooltip.Provider
                    delayDuration={120}
                    skipDelayDuration={300}
                  >
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {layer.badges.map((badgeKey) => (
                        <PublishBadge
                          key={badgeKey}
                          badgeKey={badgeKey}
                          logs={[]}
                          t={t}
                          isFolder={false}
                          tableOfContentsItemId={draftItem.id}
                          dataLibraryTemplateId={
                            draftItem.dataLayer?.dataSource
                              ?.dataLibraryTemplateId
                          }
                          onOpenMetadata={() =>
                            setMetadataModal(draftItem.id)
                          }
                          onOpenCartography={() =>
                            setCartographyModal(draftItem.id)
                          }
                        />
                      ))}
                    </div>
                  </Tooltip.Provider>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>
      {metadataModal && (
        <LayerMetadataRevisionModal
          tableOfContentsItemId={metadataModal}
          onRequestClose={() => setMetadataModal(null)}
        />
      )}
      {cartographyModal && (
        <LayerCartographyRevisionModal
          tableOfContentsItemId={cartographyModal}
          onRequestClose={() => setCartographyModal(null)}
        />
      )}
    </>
  );
}
