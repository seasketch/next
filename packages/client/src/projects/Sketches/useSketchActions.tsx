import { ReactNode, useEffect, useMemo, useState } from "react";
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
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import useDialog from "../../components/useDialog";
import { useHistory } from "react-router-dom";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import getSlug from "../../getSlug";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

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
      type: "sketch" | "folder",
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
}: {
  folderSelected: boolean;
  selectedSketchClasses: number[];
  multiple?: boolean;
  sketchClasses?: SketchingDetailsFragment[];
}) {
  const { t } = useTranslation("sketching");
  const [state, setState] = useState<{
    create: SketchAction[];
    edit: SketchAction[];
  }>({
    create: [],
    edit: [],
  });
  const { prompt, confirm, confirmDelete } = useDialog();
  const history = useHistory();
  const onError = useGlobalErrorHandler();
  const [createFolder] = useCreateSketchFolderMutation({
    onError,
  });
  const [renameFolder] = useRenameFolderMutation({
    onError,
  });
  const [deleteSketch, deleteSketchState] = useDeleteSketchMutation({
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
  const [deleteSketchFolder, deleteSketchFolderState] =
    useDeleteSketchFolderMutation({
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
                        focus("folder", folder.id, folder.folderId);
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

  return state;
}
