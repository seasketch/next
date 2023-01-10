import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import TreeView, { TreeNodeProps } from "../../components/TreeView";
import {
  SketchChildType,
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
  useCopyTocItemForForumPostMutation,
  useSketchingQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import useSketchingSelectionState from "../Sketches/useSketchingSelectionState";
import { useCallback, useMemo, useState } from "react";
import { myPlansFragmentsToTreeItems } from "../Sketches";
import FolderItem, { isFolderNode } from "../Sketches/FolderItem";
import SketchItem, { isSketchNode } from "../Sketches/SketchItem";
import { TreeItemType } from "../Sketches/SketchingTools";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import useExpandedIds from "../Sketches/useExpandedIds";

export default function ShareSketchesModal({
  cancel,
  onSubmit,
}: {
  cancel: () => void;
  onSubmit: (
    sketches: SketchTocDetailsFragment[],
    folders: SketchFolderDetailsFragment[]
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
    onError,
    onCompleted: (d) => {
      if (d.copySketchTocItem?.folders && d.copySketchTocItem?.sketches) {
        onSubmit(d.copySketchTocItem.sketches, d.copySketchTocItem.folders);
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
    return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
  }, [data?.projectBySlug?.mySketches, data?.projectBySlug?.myFolders]);

  const treeRenderFn = useCallback(
    ({ node, ...props }: TreeNodeProps<TreeItemType>) => {
      if (isFolderNode(node) && props.children) {
        return <FolderItem {...props} node={node} />;
      } else if (isSketchNode(node)) {
        return <SketchItem {...props} node={node} />;
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        return <div>Unimplemented</div>;
      }
    },
    []
  );

  const { expandedIds, onExpand } = useExpandedIds(
    getSlug(),
    data?.projectBySlug?.myFolders,
    data?.projectBySlug?.mySketches
  );

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
        <DndProvider backend={HTML5Backend}>
          {loading && !data && <Spinner />}
          {data && (
            <>
              <TreeView
                items={treeItems}
                render={treeRenderFn}
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
        </DndProvider>
      </div>
    </Modal>
  );
}
