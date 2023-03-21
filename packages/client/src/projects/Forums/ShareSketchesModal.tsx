import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import TreeView, { parseTreeItemId, TreeItem } from "../../components/TreeView";
import {
  SketchChildType,
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
  useCopyTocItemForForumPostMutation,
  useSketchingQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useMemo, useState } from "react";
import { myPlansFragmentsToTreeItems } from "../Sketches";
import { useSketchUIState } from "../Sketches/SketchUIStateContextProvider";

export default function ShareSketchesModal({
  cancel,
  onSubmit,
}: {
  cancel: () => void;
  onSubmit: (
    sketches: SketchTocDetailsFragment[],
    folders: SketchFolderDetailsFragment[],
    copiedSketches: number[]
  ) => void;
}) {
  const { t } = useTranslation("sketching");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
  });

  const [selection, setSelected] = useState<string[]>([]);

  const [copy, mutationState] = useCopyTocItemForForumPostMutation({
    // onError,
    onCompleted: (d) => {
      if (d.copySketchTocItem?.folders && d.copySketchTocItem?.sketches) {
        const treeItem = treeItems.find((item) => item.id === selection[0]);
        if (treeItem?.isLeaf === true) {
          onSubmit(d.copySketchTocItem.sketches, d.copySketchTocItem.folders, [
            parseInt(selection[0].split(":")[1]),
          ]);
        } else {
          onSubmit(
            d.copySketchTocItem.sketches,
            d.copySketchTocItem.folders,
            getCopiedSketchesRecursive(
              parseInt(selection[0].split(":")[1]),
              treeItems
            )
          );
        }
      }
    },
  });

  /**
   * Convert GraphQL fragment data into a flat list of TreeItemI elements for
   * feeding into TreeView
   */
  const treeItems = useMemo(() => {
    const sketches = data?.projectBySlug?.mySketches || [];
    const folders = data?.projectBySlug?.myFolders || [];
    const items = myPlansFragmentsToTreeItems([...sketches, ...folders]);
    return items.sort((a, b) => a.title.localeCompare(b.title));
  }, [data?.projectBySlug?.mySketches, data?.projectBySlug?.myFolders]);

  const { expandedIds, onExpand } = useSketchUIState();

  return (
    <Modal
      disableBackdropClick={loading}
      scrollable={true}
      footer={[
        {
          label: t("Cancel"),
          onClick: cancel,
          disabled: mutationState.loading,
        },
        {
          variant: "primary",
          label: t("Share"),
          onClick: async () => {
            if (selection.length > 0) {
              const [type, id] = selection[0].split(":");
              copy({
                variables: {
                  id: parseInt(id),
                  type:
                    type === "Sketch"
                      ? SketchChildType.Sketch
                      : SketchChildType.SketchFolder,
                },
              });
            }
          },
          disabled: selection.length === 0 || mutationState.loading,
          loading: mutationState.loading,
        },
      ]}
      onRequestClose={cancel}
      title={t("Choose a sketch to share...")}
    >
      <div className="h-72 px-4 pb-8">
        {loading && !data && <Spinner />}
        {data && (
          <>
            <TreeView
              items={treeItems}
              ariaLabel={"Sketch List"}
              disableEditing={true}
              expanded={expandedIds}
              onExpand={onExpand}
              hideCheckboxes={true}
              selection={selection}
              onSelect={(metaKey, node, isSelected) => {
                setSelected((prev) => {
                  return [node.id];
                });
              }}
            />
            <div className="h-4"></div>
          </>
        )}
      </div>
    </Modal>
  );
}

function getCopiedSketchesRecursive(parentId: number, items: TreeItem[]) {
  const ids: number[] = [];
  for (const item of items) {
    const itemParentId = item.parentId
      ? parseTreeItemId(item.parentId).id
      : undefined;
    if (itemParentId === parentId) {
      const id = parseTreeItemId(item.id).id;
      if (item.type === "Sketch") {
        ids.push(id as number);
      }
      const children = getCopiedSketchesRecursive(id as number, items);
      if (children && children.length) {
        ids.push(...children);
      }
    }
  }
  return ids;
}
