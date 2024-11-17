import { TocMenuItemType } from "./TableOfContentsItemMenu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as MenuBar from "@radix-ui/react-menubar";
import { MenuBarItemClasses } from "../../components/Menubar";
import { Trans, useTranslation } from "react-i18next";
import useDialog from "../../components/useDialog";
import {
  DataSourceTypes,
  DraftTableOfContentsDocument,
  ExtraTocEditingInfoDocument,
  useDeleteBranchMutation,
  useDuplicateTableOfContentsItemMutation,
  useProjectMetadataQuery,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useContext, useState } from "react";
import { LayerEditingContext } from "./LayerEditingContext";
import getSlug from "../../getSlug";
import { ProjectBackgroundJobContext } from "../uploads/ProjectBackgroundJobContext";
import { TreeItem } from "../../components/TreeView";

export default function TableOfContentsItemAdminMenuItems({
  type,
  items,
  onExpand,
}: {
  type: typeof DropdownMenu | typeof ContextMenu | typeof MenuBar;
  items: TocMenuItemType[];
  onExpand?: (node: TreeItem, isExpanded: boolean) => void;
}) {
  const MenuType = type;
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { confirmDelete } = useDialog();
  const [duplicateItem] = useDuplicateTableOfContentsItemMutation({
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
  });

  const [deleteItem] = useDeleteBranchMutation({
    onError,
    refetchQueries: [ExtraTocEditingInfoDocument],
  });
  const layerEditingContext = useContext(LayerEditingContext);
  const projectMetadataQuery = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const backgroundJobContext = useContext(ProjectBackgroundJobContext);

  const item = items[0];

  return (
    <>
      <MenuType.Item
        style={{
          minWidth: 120,
        }}
        onSelect={() => {
          layerEditingContext.setOpenEditor({
            id: item.id,
            isFolder: item.isFolder,
            title: item.title,
          });
        }}
        className={MenuBarItemClasses}
      >
        {t("Edit")}
      </MenuType.Item>
      {item.isFolder && (
        <MenuType.Item
          style={{ minWidth: 120 }}
          className={MenuBarItemClasses}
          onSelect={() => {
            if (onExpand) {
              onExpand(
                {
                  ...item,
                  isLeaf: false,
                  id: item.stableId,
                  type: "",
                },
                true
              );
            }
            layerEditingContext.setCreateFolderModal({
              open: true,
              parentStableId: item.stableId,
            });
          }}
        >
          {t("Add Folder")}
        </MenuType.Item>
      )}
      {/* <MenuType.Item
        style={{
          minWidth: 120,
        }}
        onSelect={() => {
          layerEditingContext.setOpenMetadataEditor(item.id);
        }}
        className={MenuBarItemClasses}
      >
        {t("Edit Metadata")}
      </MenuType.Item> */}
      {(item.dataSourceType ===
        DataSourceTypes.ArcgisDynamicMapserverVectorSublayer ||
        item.dataSourceType === DataSourceTypes.ArcgisVector) && (
        <>
          <MenuType.Item
            style={{
              minWidth: 120,
            }}
            onSelect={() => {
              backgroundJobContext?.openHostFeatureLayerOnSeaSketchModal(
                item.id
              );
            }}
            className={MenuBarItemClasses}
          >
            {t("Host on SeaSketch...")}
          </MenuType.Item>
        </>
      )}
      <MenuType.Item
        className={MenuBarItemClasses}
        onSelect={async () => {
          if (item) {
            await duplicateItem({
              variables: {
                id: item.id as number,
              },
            });
          }
        }}
      >
        <Trans ns="admin:data">Duplicate</Trans>
      </MenuType.Item>
      <MenuType.Item
        onSelect={async () => {
          if (item) {
            await confirmDelete({
              message: t("Delete Item"),
              description: t("Are you sure you want to delete {{name}}?", {
                name: item.title.replace(/\.$/, ""),
              }),
              onDelete: async () => {
                if (layerEditingContext.openEditor?.id === item.id) {
                  layerEditingContext.setOpenEditor(undefined);
                }
                layerEditingContext.setRecentlyDeletedStableIds((prev) => {
                  return [...prev, item.stableId];
                });
                await deleteItem({
                  variables: {
                    id: item.id as number,
                  },
                  update: (cache, { data }) => {
                    if (projectMetadataQuery.data?.project) {
                      cache.modify({
                        broadcast: true,
                        id: cache.identify(projectMetadataQuery.data.project),
                        fields: {
                          draftTableOfContentsItems(
                            existingRefs = [],
                            { readField }
                          ) {
                            return existingRefs.filter(
                              (ref: any) => item.id !== readField("id", ref)
                            );
                          },
                          draftTableOfContentsHasChanges() {
                            return true;
                          },
                        },
                      });
                    }
                  },
                });
              },
            });
          }
        }}
        className={MenuBarItemClasses}
      >
        <Trans ns="admin:data">Delete</Trans>
      </MenuType.Item>
    </>
  );
}
