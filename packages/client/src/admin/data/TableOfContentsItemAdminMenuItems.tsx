import { TocMenuItemType } from "./TableOfContentsItemMenu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as MenuBar from "@radix-ui/react-menubar";
import { MenuBarItemClasses } from "../../components/Menubar";
import { Trans, useTranslation } from "react-i18next";
import useDialog from "../../components/useDialog";
import {
  DraftTableOfContentsDocument,
  useDeleteBranchMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useContext } from "react";
import { LayerEditingContext } from "./LayerEditingContext";

export default function TableOfContentsItemAdminMenuItems({
  type,
  items,
}: {
  type: typeof DropdownMenu | typeof ContextMenu | typeof MenuBar;
  items: TocMenuItemType[];
}) {
  const MenuType = type;
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { confirmDelete } = useDialog();
  const [deleteItem] = useDeleteBranchMutation({
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
  });
  const layerEditingContext = useContext(LayerEditingContext);

  const item = items[0];

  return (
    <>
      <MenuType.Item
        onSelect={() => {
          layerEditingContext.setOpenEditor(item.id);
        }}
        className={MenuBarItemClasses}
      >
        {t("Edit")}
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
                if (layerEditingContext.openEditor === item.id) {
                  layerEditingContext.setOpenEditor(undefined);
                }
                layerEditingContext.setRecentlyDeletedStableIds((prev) => {
                  return [...prev, item.stableId];
                });
                await deleteItem({
                  variables: {
                    id: item.id as number,
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
