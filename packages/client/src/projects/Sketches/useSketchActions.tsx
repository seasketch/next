import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  SketchingDetailsFragment,
  SketchingDocument,
  SketchingQuery,
  SketchTocDetailsFragment,
  useCreateSketchFolderMutation,
  useDeleteSketchFolderMutation,
  useDeleteSketchMutation,
  useRenameFolderMutation,
  SketchFolderDetailsFragment,
  SketchEditorModalDetailsFragment,
  GetSketchForEditingDocument,
  GetSketchForEditingQuery,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import useDialog from "../../components/useDialog";
import { useHistory } from "react-router-dom";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import getSlug from "../../getSlug";
import { useApolloClient } from "@apollo/client";
import { DropdownOption } from "../../components/DropdownButton";
import { DropdownDividerProps } from "../../components/ContextMenuDropdown";

export interface SketchAction {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  disabledForContextAction?: boolean;
  action: (props: {
    selectedSketches: SketchTocDetailsFragment[];
    selectedFolders: SketchFolderDetailsFragment[];
    setEditor: (options: {
      id?: number;
      sketchClass: SketchingDetailsFragment;
      folderId?: number;
      collectionId?: number;
      loadingTitle?: string;
    }) => void;
    focus: (
      type: "Sketch" | "SketchFolder",
      id: number,
      folderId?: number | null,
      collectionId?: number | null
    ) => void;
    clearSelection: () => void;
    collapseFolder: (id: number) => void;
  }) => Promise<void>;
  keycode?: string;
}

export default function useSketchActions({
  folderSelected,
  selectedSketchClasses,
  multiple,
  sketchClasses,
  clearSelection,
  selectedIds,
  setContextMenu,
  setExpandedIds,
  focusOnTableOfContentsItem,
  setEditor,
  sketches,
  folders,
}: {
  folderSelected: boolean;
  selectedSketchClasses: number[];
  multiple?: boolean;
  sketchClasses?: SketchingDetailsFragment[];
  clearSelection: () => void;
  selectedIds: string[];
  setContextMenu: Dispatch<
    SetStateAction<
      | {
          id: string;
          target: HTMLElement;
          offsetX: number;
        }
      | undefined
    >
  >;
  setExpandedIds: (value: SetStateAction<string[]>) => void;
  focusOnTableOfContentsItem: (
    type: "Sketch" | "SketchFolder",
    id: number,
    folderId?: number | null,
    collectionId?: number | null
  ) => void;
  setEditor: Dispatch<
    SetStateAction<
      | false
      | {
          sketch?: SketchEditorModalDetailsFragment | undefined;
          sketchClass: SketchingDetailsFragment;
          folderId?: number | undefined;
          loading?: boolean | undefined;
          loadingTitle?: string | undefined;
        }
    >
  >;
  sketches?: SketchTocDetailsFragment[] | null;
  folders?: SketchFolderDetailsFragment[] | null;
}) {
  const { t } = useTranslation("sketching");
  const client = useApolloClient();
  const onError = useGlobalErrorHandler();
  const [{ create, edit }, setState] = useState<{
    create: SketchAction[];
    edit: SketchAction[];
  }>({
    create: [],
    edit: [],
  });
  const { prompt, confirmDelete } = useDialog();
  const history = useHistory();
  const [createFolder] = useCreateSketchFolderMutation({
    onError,
  });
  const [renameFolder] = useRenameFolderMutation({
    onError,
  });
  const [deleteSketch] = useDeleteSketchMutation({
    onError,
    update: async (cache, { data }) => {
      if (data?.deleteSketch?.sketch?.id) {
        const sketch = data.deleteSketch.sketch;
        const results = cache.readQuery<SketchingQuery>({
          query: SketchingDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (results?.projectBySlug?.mySketches) {
          await cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                mySketches: [
                  ...results.projectBySlug.mySketches.filter(
                    (s) => s.id !== sketch.id
                  ),
                ],
              },
            },
          });
        }
      }
    },
  });
  const [deleteSketchFolder] = useDeleteSketchFolderMutation({
    onError,
    update: async (cache, { data }) => {
      if (data?.deleteSketchFolder?.sketchFolder) {
        const folder = data.deleteSketchFolder.sketchFolder;
        const results = cache.readQuery<SketchingQuery>({
          query: SketchingDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (results?.projectBySlug?.myFolders) {
          await cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                myFolders: [
                  ...results.projectBySlug.myFolders.filter(
                    (f) => f.id !== folder.id
                  ),
                ],
              },
            },
          });
        }
      }
    },
  });

  useEffect(() => {
    function isValidChild(parentId: number, child: SketchingDetailsFragment) {
      const parent = sketchClasses?.find((sc) => sc.id === parentId);
      if (parent) {
        return Boolean(
          parent.validChildren?.find((validChild) => validChild.id === child.id)
        );
      } else {
        return false;
      }
    }
    setState({
      create: [
        ...(sketchClasses || [])
          .filter((sc) => !sc.formElementId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (sc) =>
              ({
                // eslint-disable-next-line i18next/no-literal-string
                id: `create-${sc.id}`,
                label: sc.name,
                disabledForContextAction:
                  multiple ||
                  (selectedSketchClasses.length > 0 &&
                    !isValidChild(selectedSketchClasses[0], sc)),
                action: ({ setEditor, selectedFolders, selectedSketches }) => {
                  history.replace(`/${getSlug()}/app`);
                  setEditor({
                    sketchClass: sc,
                    folderId:
                      selectedFolders.length === 1
                        ? selectedFolders[0].id
                        : undefined,
                    collectionId:
                      !multiple && isValidChild(selectedSketchClasses[0], sc)
                        ? selectedSketches[0].id
                        : undefined,
                  });
                },
              } as SketchAction)
          ),
        {
          // eslint-disable-next-line i18next/no-literal-string
          id: `create-folder`,
          label: t("Folder"),
          disabledForContextAction:
            multiple || selectedSketchClasses.length > 0,
          action: async ({ selectedFolders, focus }) => {
            prompt({
              message: t(`What would you like to name your folder?`),
              onSubmit: async (name) => {
                if (!name.length) {
                  return;
                }
                await createFolder({
                  variables: {
                    name,
                    slug: getSlug(),
                    ...(selectedFolders.length === 1
                      ? { folderId: selectedFolders[0].id }
                      : {}),
                  },
                  update: async (cache, { data }) => {
                    if (data?.createSketchFolder?.sketchFolder) {
                      const folder = data.createSketchFolder.sketchFolder;
                      const results = cache.readQuery<SketchingQuery>({
                        query: SketchingDocument,
                        variables: {
                          slug: getSlug(),
                        },
                      });
                      if (results?.projectBySlug?.myFolders) {
                        await cache.writeQuery({
                          query: SketchingDocument,
                          variables: { slug: getSlug() },
                          data: {
                            ...results,
                            projectBySlug: {
                              ...results.projectBySlug,
                              myFolders: [
                                ...results.projectBySlug.myFolders,
                                folder,
                              ],
                            },
                          },
                        });
                        focus("SketchFolder", folder.id, folder.folderId);
                      }
                    }
                  },
                });
              },
            });
          },
        },
      ],
      edit:
        selectedSketchClasses.length || folderSelected
          ? ([
              ...(!multiple && selectedSketchClasses.length
                ? ([
                    {
                      id: "edit-sketch",
                      label: t("Edit"),
                      keycode: "e",
                      action: ({ selectedSketches, setEditor }) => {
                        setTimeout(() => {
                          history.replace(`/${getSlug()}/app`);
                          setEditor({
                            id: selectedSketches[0].id,
                            loadingTitle: selectedSketches[0].name,
                            sketchClass: sketchClasses?.find(
                              (sc) => sc.id === selectedSketchClasses[0]
                            )!,
                          });
                        }, 10);
                      },
                    },
                  ] as SketchAction[])
                : []),
              ...(folderSelected && !multiple
                ? ([
                    {
                      id: "rename-folder",
                      label: t("Rename Folder"),
                      keycode: "e",
                      action: async ({ selectedFolders }) => {
                        const folder = selectedFolders[0]!;
                        await prompt({
                          message: t(`Rename "${folder.name}"`),
                          defaultValue: folder.name,
                          onSubmit: async (name) => {
                            if (name.length) {
                              await renameFolder({
                                variables: {
                                  id: folder.id,
                                  name,
                                },
                              });
                            }
                          },
                        });
                      },
                    },
                  ] as SketchAction[])
                : []),

              {
                id: "delete",
                label: t("Delete"),
                disabled: multiple,
                keycode: "Backspace",
                action: ({
                  selectedSketches,
                  selectedFolders,
                  clearSelection,
                  collapseFolder,
                }) => {
                  // TODO: implement multiple-delete
                  // TODO: warn of child deletes
                  if (multiple) {
                    throw new Error("Multiple delete not implemented");
                  }
                  const item = selectedSketches[0] || selectedFolders[0];
                  confirmDelete({
                    message: t(
                      `Are you sure you want to delete "${item.name}"?`
                    ),
                    onDelete: async () => {
                      clearSelection();
                      if (selectedFolders.length > 0) {
                        collapseFolder(item.id);
                      }
                      await (selectedSketches.length > 0
                        ? deleteSketch
                        : deleteSketchFolder)({
                        variables: {
                          id: item.id,
                        },
                      });
                    },
                  });
                },
              },
            ] as SketchAction[])
          : [],
    });
  }, [
    selectedSketchClasses,
    multiple,
    sketchClasses,
    history,
    prompt,
    t,
    createFolder,
    folderSelected,
    confirmDelete,
    deleteSketch,
    deleteSketchFolder,
    renameFolder,
  ]);

  /**
   * Actions require quite a few parameters when called that depend on the state
   * of the app and current data. Much of this is bundled into parameters so
   * that these are recalculated when the action is actually called vs
   * recalculating them on ever render of the actions list. Might be a good idea
   * to extract this to useSketchActions to organize things better.
   */
  const callAction = useCallback(
    (action: SketchAction) => {
      setContextMenu(undefined);
      action.action({
        selectedSketches: selectedIds
          .filter((id) => /Sketch:/.test(id))
          .map((id) => parseInt(id.split(":")[1]))
          .map((id) => (sketches || []).find((s) => s.id === id)!),
        selectedFolders: selectedIds
          .filter((id) => /SketchFolder:/.test(id))
          .map((id) => parseInt(id.split(":")[1]))
          .map(
            (folderId) => (folders || []).find(({ id }) => id === folderId)!
          ),
        setEditor: async (options: any) => {
          setEditor({
            ...options,
            loading: options.id ? true : false,
          });
          if (options.id) {
            // load the sketch
            try {
              const response = await client.query<GetSketchForEditingQuery>({
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
        clearSelection,
        collapseFolder: (id: number) => {
          setExpandedIds((prev) => [
            ...prev.filter((i) => i !== `SketchFolder:${id}`),
          ]);
        },
      });
    },
    [
      client,
      onError,
      clearSelection,
      selectedIds,
      setExpandedIds,
      setContextMenu,
      focusOnTableOfContentsItem,
      folders,
      sketches,
      setEditor,
    ]
  );

  const menuOptions = useMemo(() => {
    const contextMenu: (DropdownOption | DropdownDividerProps)[] = [];
    if ((create || edit) && callAction) {
      for (const action of edit) {
        const { label, disabled, disabledForContextAction } = action;
        if (!disabledForContextAction) {
          contextMenu.push({
            label,
            disabled,
            onClick: () => callAction(action),
          });
        }
      }
      const createActions = create.filter((a) => !a.disabledForContextAction);
      if (createActions.length) {
        contextMenu.push({ label: t("add new"), id: "add-new-divider" });
        for (const action of createActions) {
          const { id, label, disabled, disabledForContextAction } = action;
          if (!disabledForContextAction) {
            contextMenu.push({
              id,
              label,
              disabled,
              onClick: () => callAction(action),
            });
          }
        }
      }
    }
    return {
      contextMenu,
      create: create.map(
        (action) =>
          ({
            id: action.id,
            label: action.label,
            onClick: () => {
              callAction(action);
            },
            disabled: action.disabled,
          } as DropdownOption)
      ),
      edit: edit.map(
        (action) =>
          ({
            id: action.id,
            label: (
              <div className="flex">
                <span className="flex-1">{action.label}</span>
                {action.keycode && (
                  <span
                    style={{ fontSize: 10 }}
                    className="font-mono bg-gray-50 text-gray-500 py-0 rounded border border-gray-300 shadow-sm text-xs px-1 opacity-0 group-hover:opacity-100"
                  >
                    {action.keycode}
                  </span>
                )}
              </div>
            ),
            onClick: () => {
              callAction(action);
            },
            disabled: action.disabled,
          } as DropdownOption)
      ),
    };
  }, [create, edit, callAction, t]);

  const keyboardShortcuts = useMemo(() => {
    return edit.filter(
      (action) => action.keycode && !action.disabledForContextAction
    );
  }, [edit]);

  return {
    callAction,
    edit,
    menuOptions,
    keyboardShortcuts,
  };
}