import Button from "../../components/Button";
import DropdownButton, {
  DropdownOption,
} from "../../components/DropdownButton";
import {
  ProjectAppSidebarContext,
  ProjectAppSidebarToolbar,
} from "../ProjectAppSidebar";
import { Trans as I18n, useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import {
  GetSketchForEditingDocument,
  GetSketchForEditingQuery,
  SketchEditorModalDetailsFragment,
  SketchingDetailsFragment,
  useSketchingQuery,
} from "../../generated/graphql";
import { useContext, useMemo, useState, useEffect, useCallback } from "react";
import SketchTableOfContents from "./SketchTableOfContents";
import SketchEditorModal from "./SketchEditorModal";
import { useHistory } from "react-router-dom";
import { memo } from "react";
import useSketchActions from "./useSketchActions";
import { useApolloClient } from "@apollo/client";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default memo(function SketchingTools({ hidden }: { hidden?: boolean }) {
  const { t } = useTranslation("sketching");
  const { data, loading } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const { isSmall } = useContext(ProjectAppSidebarContext);

  const [editor, setEditor] =
    useState<
      | false
      | {
          sketch?: SketchEditorModalDetailsFragment;
          sketchClass: SketchingDetailsFragment;
          folderId?: number;
          loading?: boolean;
          loadingTitle?: string;
        }
    >(false);

  const [selectedSketchIds, setSelectedSketchIds] = useState<number[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [toolbarRef, setToolbarRef] = useState<HTMLDivElement | null>(null);
  const [tocContainer, setTocContainer] = useState<HTMLDivElement | null>(null);
  const onError = useGlobalErrorHandler();
  const client = useApolloClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        toolbarRef &&
        (toolbarRef === target || toolbarRef.contains(target))
      ) {
        return;
      } else if (
        tocContainer &&
        tocContainer.contains(target) &&
        tocContainer !== target
      ) {
        return;
      }
      setSelectedFolderIds([]);
      setSelectedSketchIds([]);
    };
    document.body.addEventListener("click", handler);
    return () => {
      document.body.removeEventListener("click", handler);
    };
  }, [tocContainer, toolbarRef, setSelectedFolderIds, setSelectedSketchIds]);

  const history = useHistory();

  const selectedSketchClasses = useMemo(() => {
    const selectedSketchClasses: number[] = [];
    if (data?.projectBySlug?.mySketches?.length) {
      const sketches = data.projectBySlug.mySketches;
      if (selectedSketchIds) {
        for (const id of selectedSketchIds) {
          const sketch = sketches.find((s) => s.id === id);
          if (
            sketch &&
            selectedSketchClasses.indexOf(sketch.sketchClassId) === -1
          ) {
            selectedSketchClasses.push(sketch.sketchClassId);
          }
        }
      }
    }
    return selectedSketchClasses;
  }, [data?.projectBySlug?.mySketches, selectedSketchIds]);

  const actions = useSketchActions({
    folderSelected: selectedFolderIds.length > 0,
    selectedSketchClasses,
    multiple: selectedFolderIds.length > 1 || selectedSketchIds.length > 1,
    sketchClasses: data?.projectBySlug?.sketchClasses,
  });

  const focusOnTableOfContentsItem = useCallback(
    // TODO: expand parents if necessary
    (type: "sketch" | "folder", id: number) => {
      if (type === "folder") {
        setSelectedFolderIds([id]);
        setSelectedSketchIds([]);
      } else {
        setSelectedFolderIds([]);
        setSelectedSketchIds([id]);
      }
    },
    [setSelectedFolderIds, setSelectedSketchIds]
  );

  const createDropdownOptions = useMemo(() => {
    return actions.create.map(
      ({ action, label, disabled }) =>
        ({
          label,
          onClick: () => {
            action({
              selectedSketches: selectedSketchIds.map(
                (id) =>
                  (data?.projectBySlug?.mySketches || []).find(
                    (s) => s.id === id
                  )!
              ),
              selectedFolders: selectedFolderIds.map(
                (id) =>
                  (data?.projectBySlug?.myFolders || []).find(
                    (f) => f.id === id
                  )!
              ),
              setEditor,
              focus: focusOnTableOfContentsItem,
              clearSelection: () => {
                setSelectedFolderIds([]);
                setSelectedSketchIds([]);
              },
            });
          },
          disabled,
        } as DropdownOption)
    );
  }, [
    actions.create,
    data?.projectBySlug?.myFolders,
    data?.projectBySlug?.mySketches,
    focusOnTableOfContentsItem,
    selectedFolderIds,
    selectedSketchIds,
  ]);

  const editDropdownOptions = useMemo(() => {
    return actions.edit.map(
      ({ action, label, disabled }) =>
        ({
          label,
          onClick: () => {
            action({
              selectedSketches: selectedSketchIds.map(
                (id) =>
                  (data?.projectBySlug?.mySketches || []).find(
                    (s) => s.id === id
                  )!
              ),
              selectedFolders: selectedFolderIds.map(
                (id) =>
                  (data?.projectBySlug?.myFolders || []).find(
                    (f) => f.id === id
                  )!
              ),
              setEditor: async (options: any) => {
                setEditor({
                  ...options,
                  loading: options.id ? true : false,
                });
                if (options.id) {
                  // load the sketch
                  try {
                    const response =
                      await client.query<GetSketchForEditingQuery>({
                        query: GetSketchForEditingDocument,
                        variables: {
                          id: options.id,
                        },
                      });
                    // then set editor state again with sketch, loading=false
                    if (response.data.sketch) {
                      setEditor((prev) => {
                        if (prev) {
                          return {
                            ...prev,
                            sketch: response.data.sketch!,
                            loading: false,
                            loadingTitle: undefined,
                          };
                        } else {
                          return false;
                        }
                      });
                    } else {
                      if (response.error) {
                        throw new Error(response.error.message);
                      } else {
                        throw new Error(
                          "Unknown query error when retrieving sketch data"
                        );
                      }
                    }
                  } catch (e) {
                    onError(e);
                    setEditor(false);
                  }
                }
              },
              focus: focusOnTableOfContentsItem,
              clearSelection: () => {
                setSelectedFolderIds([]);
                setSelectedSketchIds([]);
              },
            });
          },
          disabled,
        } as DropdownOption)
    );
  }, [
    actions.edit,
    client,
    data?.projectBySlug?.myFolders,
    data?.projectBySlug?.mySketches,
    focusOnTableOfContentsItem,
    onError,
    selectedFolderIds,
    selectedSketchIds,
  ]);

  return (
    <div style={{ display: hidden ? "none" : "block" }}>
      {!hidden && (
        <ProjectAppSidebarToolbar ref={(el) => setToolbarRef(el)}>
          <DropdownButton
            small
            alignment="left"
            label={
              isSmall ? <Trans>Create</Trans> : <Trans>Create New...</Trans>
            }
            options={createDropdownOptions}
            disabled={editor !== false}
          />
          <DropdownButton
            small
            disabled={editDropdownOptions.length === 0}
            alignment="left"
            label={<Trans>Edit</Trans>}
            options={editDropdownOptions}
          />
          <Button
            disabled
            small
            label={
              isSmall ? (
                <Trans>View Attributes</Trans>
              ) : (
                <Trans>View Attributes and Reports</Trans>
              )
            }
          />
        </ProjectAppSidebarToolbar>
      )}
      <SketchTableOfContents
        ref={(tocContainer) => setTocContainer(tocContainer)}
        folders={data?.projectBySlug?.myFolders || []}
        sketches={data?.projectBySlug?.mySketches || []}
        loading={loading}
        selectedFolderIds={selectedFolderIds}
        selectedSketchIds={selectedSketchIds}
        onSelectionChange={(item, isSelected) => {
          if (item.__typename === "SketchFolder") {
            setSelectedFolderIds((prev) => [
              ...prev.filter((f) => f !== item.id),
              ...(isSelected ? [item.id] : []),
            ]);
          } else {
            setSelectedSketchIds((prev) => [
              ...prev.filter((f) => f !== item.id),
              ...(isSelected ? [item.id] : []),
            ]);
          }
        }}
      />
      {editor !== false && (
        <SketchEditorModal
          sketchClass={editor?.sketchClass}
          sketch={editor?.sketch}
          loading={editor?.loading}
          loadingTitle={editor?.loading ? editor.loadingTitle : undefined}
          folderId={editor?.folderId}
          onComplete={(item) => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
            focusOnTableOfContentsItem("sketch", item.id);
          }}
          onCancel={() => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
          }}
        />
      )}
    </div>
  );
});
