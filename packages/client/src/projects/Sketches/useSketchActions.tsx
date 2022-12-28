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
  useCopySketchMutation,
  useCopySketchFolderMutation,
  useCopyTocItemMutation,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import useDialog from "../../components/useDialog";
import { useHistory } from "react-router-dom";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import getSlug from "../../getSlug";
import { useApolloClient } from "@apollo/client";
import { DropdownOption } from "../../components/DropdownButton";
import { DropdownDividerProps } from "../../components/ContextMenuDropdown";
import { ReportWindowUIState } from "./SketchReportWindow";
import { actions } from "react-table";
import { SketchChildType, SketchGeometryType } from "../../generated/queries";
import { download } from "../../download";
import useAccessToken from "../../useAccessToken";
import { BASE_SERVER_ENDPOINT } from "../../dataLayers/MapContextManager";
import { treeItemId } from ".";

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
  zoomTo,
  openSketchReport,
  clearOpenSketchReports,
  showSketches,
  hideSketches,
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
  zoomTo: (bbox: number[]) => void;
  openSketchReport: (id: number, uiState?: ReportWindowUIState) => void;
  clearOpenSketchReports: () => void;
  showSketches: (ids: string[]) => void;
  hideSketches: (ids: string[]) => void;
}) {
  const { t } = useTranslation("sketching");
  const token = useAccessToken();
  const client = useApolloClient();
  const onError = useGlobalErrorHandler();
  const [{ create, edit }, setState] = useState<{
    create: SketchAction[];
    edit: SketchAction[];
  }>({
    create: [],
    edit: [],
  });
  const isCollection =
    selectedSketchClasses.length === 1 &&
    sketchClasses?.find((c) => c.id === selectedSketchClasses[0])
      ?.geometryType === SketchGeometryType.Collection;
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
          // Will need to find all child items, including both folder and sketches,
          // and remove them from the list
          const deletedIds = getChildrenOfSketchOrSketchFolder(
            sketch,
            results.projectBySlug.myFolders || [],
            results.projectBySlug.mySketches || []
          );

          await cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                myFolders: [
                  ...(results.projectBySlug.myFolders || []).filter(
                    (f) => deletedIds.folders.indexOf(f.id) === -1
                  ),
                ],
                mySketches: [
                  ...(results.projectBySlug.mySketches || []).filter(
                    (s) => deletedIds.sketches.indexOf(s.id) === -1
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
          // Will need to find all child items, including both folder and sketches,
          // and remove them from the list
          const deletedIds = getChildrenOfSketchOrSketchFolder(
            folder,
            results.projectBySlug.myFolders || [],
            results.projectBySlug.mySketches || []
          );

          await cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                myFolders: [
                  ...results.projectBySlug.myFolders.filter(
                    (f) => deletedIds.folders.indexOf(f.id) === -1
                  ),
                ],
                mySketches: [
                  ...(results.projectBySlug.mySketches || []).filter(
                    (s) => deletedIds.sketches.indexOf(s.id) === -1
                  ),
                ],
              },
            },
          });
        }
      }
    },
  });

  const [copy] = useCopyTocItemMutation({
    onError,
    update: async (cache, response) => {
      const sketches = response.data?.copySketchTocItem?.sketches || [];
      const folders = response.data?.copySketchTocItem?.folders || [];
      const results = cache.readQuery<SketchingQuery>({
        query: SketchingDocument,
        variables: {
          slug: getSlug(),
        },
      });
      if (
        results?.projectBySlug?.mySketches &&
        results?.projectBySlug?.myFolders
      ) {
        await cache.writeQuery({
          query: SketchingDocument,
          variables: { slug: getSlug() },
          data: {
            ...results,
            projectBySlug: {
              ...results.projectBySlug,
              mySketches: [...results.projectBySlug.mySketches, ...sketches],
              myFolders: [...results.projectBySlug.myFolders, ...folders],
            },
          },
        });
      }
    },
  });

  const [copySketchFolder] = useCopySketchFolderMutation({
    onError,
    update: async (cache, response) => {
      if (response.data?.copySketchFolder?.sketchFolder) {
        const folder = response.data.copySketchFolder.sketchFolder;
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
                myFolders: [...results.projectBySlug.myFolders, folder],
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
          .filter((sc) => !sc.formElementId && !sc.isArchived && sc.canDigitize)
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
                      id: "view-reports",
                      label: t("View Reports"),
                      keycode: "v",
                      action: ({ selectedSketches }) => {
                        openSketchReport(selectedSketches[0].id);
                      },
                    },
                    {
                      id: "edit-sketch",
                      label: t("Edit"),
                      keycode: "e",
                      action: ({ selectedSketches, setEditor }) => {
                        clearOpenSketchReports();
                        showSketches(
                          // eslint-disable-next-line i18next/no-literal-string
                          selectedSketches.map((s) => `Sketch:${s.id}`)
                        );
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
              ...(selectedSketchClasses || folderSelected
                ? ([
                    {
                      id: "copy",
                      label: t("Copy"),
                      action: async ({
                        selectedSketches,
                        selectedFolders,
                        focus,
                      }) => {
                        const item = selectedSketches[0] || selectedFolders[0];
                        if (item) {
                          const type = selectedSketches.length
                            ? SketchChildType.Sketch
                            : SketchChildType.SketchFolder;
                          const response = await copy({
                            variables: {
                              id: item.id,
                              type,
                            },
                          });
                          const parentId =
                            response.data?.copySketchTocItem?.parentId;
                          const sketches =
                            response.data?.copySketchTocItem?.sketches || [];
                          if (parentId) {
                            clearSelection();
                            setTimeout(() => {
                              focus(
                                type === SketchChildType.Sketch
                                  ? "Sketch"
                                  : "SketchFolder",
                                parentId
                              );
                              showSketches(
                                sketches.map((s) => treeItemId(s.id, "Sketch"))
                              );
                            }, 100);
                          }
                        }
                      },
                    },
                  ] as SketchAction[])
                : []),
              ...(selectedSketchClasses && !folderSelected && !isCollection
                ? ([
                    {
                      id: "zoom-to",
                      label: t("Zoom to"),
                      disabled: multiple,
                      action: ({ selectedSketches }) => {
                        // TODO: support multiple
                        let bbox = selectedSketches[0].bbox;
                        if (bbox) {
                          zoomTo(bbox as number[]);
                        }
                      },
                    },
                  ] as SketchAction[])
                : []),
              ...(selectedSketchClasses && !multiple && !folderSelected
                ? ([
                    {
                      id: "export",
                      label: t("Export as GeoJSON"),
                      disabled: multiple,
                      action: ({ selectedSketches }) => {
                        // TODO: support multiple
                        download(
                          // eslint-disable-next-line i18next/no-literal-string
                          `${BASE_SERVER_ENDPOINT}/sketches/${
                            selectedIds[0].split(":")[1]
                          }.geojson.json?token=${token}`,
                          // eslint-disable-next-line i18next/no-literal-string
                          `${selectedIds[0].replace(":", "-")}.geojson.json`
                        );
                      },
                    },
                  ] as SketchAction[])
                : []),
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
    zoomTo,
    openSketchReport,
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
    const viewReportsAction = edit.find((a) => a.id === "view-reports");

    return {
      contextMenu,
      viewReports: viewReportsAction
        ? {
            id: viewReportsAction.id,
            label: viewReportsAction.label,
            onClick: () => callAction(viewReportsAction),
            disabled: viewReportsAction.disabled,
          }
        : undefined,
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
      edit: edit
        .filter((a) => a.id !== "view-reports")
        .map(
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

function getChildrenOfSketchOrSketchFolder(
  parent: { __typename?: "Sketch" | "SketchFolder"; id: number },
  folders: {
    __typename?: "Sketch" | "SketchFolder";
    id: number;
    collectionId?: number | null;
    folderId?: number | null;
  }[],
  sketches: {
    __typename?: "Sketch" | "SketchFolder";
    id: number;
    collectionId?: number | null;
    folderId?: number | null;
  }[],
  deletedIds = { sketches: [] as number[], folders: [] as number[] }
) {
  let isSketch = false;
  if (parent.__typename === "Sketch") {
    isSketch = true;
    deletedIds.sketches.push(parent.id);
  } else {
    deletedIds.folders.push(parent.id);
  }
  let found = false;
  for (const folder of folders) {
    if ((isSketch ? folder.collectionId : folder.folderId) === parent.id) {
      found = true;
      getChildrenOfSketchOrSketchFolder(folder, folders, sketches, deletedIds);
      break;
    }
  }
  if (!found) {
    for (const sketch of sketches) {
      if ((isSketch ? sketch.collectionId : sketch.folderId) === parent.id) {
        found = true;
        getChildrenOfSketchOrSketchFolder(
          sketch,
          folders,
          sketches,
          deletedIds
        );
        break;
      }
    }
  }
  return deletedIds;
}
