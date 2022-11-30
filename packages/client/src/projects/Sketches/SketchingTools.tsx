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
import {
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  FC,
} from "react";
import SketchEditorModal from "./SketchEditorModal";
import { useHistory } from "react-router-dom";
import { memo } from "react";
import useSketchActions, { SketchAction } from "./useSketchActions";
import { useApolloClient } from "@apollo/client";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useAuth0 } from "@auth0/auth0-react";
import { DropTargetMonitor, useDrop } from "react-dnd";
import ContextMenuDropdown, {
  DropdownDividerProps,
} from "../../components/ContextMenuDropdown";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import TreeView, { TreeNodeProps } from "../../components/TreeView";
import FolderItem, { FolderNodeDataProps, isFolderNode } from "./FolderItem";
import SketchItem, { isSketchNode, SketchNodeDataProps } from "./SketchItem";
import { myPlansFragmentsToTreeItems, treeItemId } from ".";
import Skeleton from "../../components/Skeleton";
import useExpandedIds from "./useExpandedIds";
import LoginPrompt from "./LoginPrompt";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default memo(function SketchingTools({ hidden }: { hidden?: boolean }) {
  const { t } = useTranslation("sketching");
  const { data, loading } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const { isSmall } = useContext(ProjectAppSidebarContext);
  const { user } = useAuth0();

  const [editor, setEditor] = useState<
    | false
    | {
        sketch?: SketchEditorModalDetailsFragment;
        sketchClass: SketchingDetailsFragment;
        folderId?: number;
        loading?: boolean;
        loadingTitle?: string;
      }
  >(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useExpandedIds(
    getSlug(),
    data?.projectBySlug?.myFolders,
    data?.projectBySlug?.mySketches
  );
  const [contextMenu, setContextMenu] = useState<
    | {
        id: string;
        // options: (DropdownOption | DropdownDividerProps)[];
        target: HTMLElement;
        offsetX: number;
      }
    | undefined
  >();

  useEffect(() => {
    setContextMenu((prev) => {
      if (prev && selectedIds.indexOf(prev.id) !== -1) {
        return prev;
      } else {
        return undefined;
      }
    });
  }, [selectedIds]);
  const { dropFolder, dropSketch } = useUpdateSketchTableOfContentsDraggable();

  const [toolbarRef, setToolbarRef] = useState<HTMLElement | null>(null);
  const [tocContainer, setTocContainer] = useState<HTMLElement | null>(null);
  const onError = useGlobalErrorHandler();
  const client = useApolloClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON") {
        return;
      }
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
      if (selectedIds.length) {
        setSelectedIds([]);
      }
      return true;
    };
    document.body.addEventListener("click", handler);
    return () => {
      document.body.removeEventListener("click", handler);
    };
  }, [tocContainer, toolbarRef, selectedIds.length, setSelectedIds]);

  const history = useHistory();

  const selectedSketchClasses = useMemo(() => {
    const selectedSketchClasses: number[] = [];
    if (data?.projectBySlug?.mySketches?.length) {
      const sketches = data.projectBySlug.mySketches;
      if (selectedIds) {
        for (const id of selectedIds) {
          if (/Sketch:/.test(id)) {
            const n = parseInt(id.split(":")[1]);
            const sketch = sketches.find((s) => s.id === n);
            if (
              sketch &&
              selectedSketchClasses.indexOf(sketch.sketchClassId) === -1
            ) {
              selectedSketchClasses.push(sketch.sketchClassId);
            }
          }
        }
      }
    }
    return selectedSketchClasses;
  }, [data?.projectBySlug?.mySketches, selectedIds]);

  const actions = useSketchActions({
    folderSelected: Boolean(selectedIds.find((id) => /SketchFolder:/.test(id))),
    selectedSketchClasses,
    multiple: selectedIds.length > 1,
    sketchClasses: data?.projectBySlug?.sketchClasses,
  });

  const focusOnTableOfContentsItem = useCallback(
    (
      type: "sketch" | "folder",
      id: number,
      folderId?: number | null,
      collectionId?: number | null
    ) => {
      let normalizedIds: string[] = [];
      if (folderId) {
        normalizedIds.push(treeItemId(folderId, "SketchFolder"));
      }
      if (collectionId) {
        normalizedIds.push(treeItemId(collectionId, "Sketch"));
      }
      if (normalizedIds.length) {
        setExpandedIds((prev) => [
          ...prev.filter((id) => normalizedIds.indexOf(id) === -1),
          ...normalizedIds,
        ]);
      }
      setSelectedIds([
        // eslint-disable-next-line i18next/no-literal-string
        treeItemId(id, type === "folder" ? `SketchFolder` : `Sketch`),
      ]);
    },
    [setExpandedIds, setSelectedIds]
  );

  const treeItems = useMemo(() => {
    const sketches = data?.projectBySlug?.mySketches || [];
    const folders = data?.projectBySlug?.myFolders || [];
    const items = myPlansFragmentsToTreeItems([...sketches, ...folders]);
    return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
  }, [data?.projectBySlug?.mySketches, data?.projectBySlug?.myFolders]);

  const callAction = useCallback(
    (action: SketchAction) => {
      action.action({
        selectedSketches: selectedIds
          .filter((id) => /Sketch:/.test(id))
          .map((id) => parseInt(id.split(":")[1]))
          .map(
            (id) =>
              (data?.projectBySlug?.mySketches || []).find((s) => s.id === id)!
          ),
        selectedFolders: selectedIds
          .filter((id) => /SketchFolder:/.test(id))
          .map((id) => parseInt(id.split(":")[1]))
          .map(
            (folderId) =>
              (data?.projectBySlug?.myFolders || []).find(
                ({ id }) => id === folderId
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
        clearSelection: () => {
          setSelectedIds([]);
          document.body.focus();
        },
        collapseFolder: (id: number) => {
          setExpandedIds((prev) => [
            ...prev.filter((i) => i !== `SketchFolder:${id}`),
          ]);
        },
      });
    },
    [
      client,
      data?.projectBySlug?.myFolders,
      data?.projectBySlug?.mySketches,
      focusOnTableOfContentsItem,
      onError,
      selectedIds,
      setExpandedIds,
      setSelectedIds,
    ]
  );

  const createDropdownOptions = useMemo(() => {
    return actions.create.map(
      (action) =>
        ({
          id: action.id,
          label: action.label,
          onClick: () => {
            callAction(action);
          },
          disabled: action.disabled,
        } as DropdownOption)
    );
  }, [actions.create, callAction]);

  const editDropdownOptions = useMemo(() => {
    return actions.edit.map(
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
    );
  }, [actions.edit, callAction]);

  const contextMenuOptions = useMemo(() => {
    const options: (DropdownOption | DropdownDividerProps)[] = [];
    if (actions && callAction) {
      for (const action of actions.edit) {
        const { label, disabled, disabledForContextAction } = action;
        if (!disabledForContextAction) {
          options.push({
            label,
            disabled,
            onClick: () => callAction(action),
          });
        }
      }
      const createActions = actions.create.filter(
        (a) => !a.disabledForContextAction
      );
      if (createActions.length) {
        options.push({ label: t("add new"), id: "add-new-divider" });
        for (const action of createActions) {
          const { id, label, disabled, disabledForContextAction } = action;
          if (!disabledForContextAction) {
            options.push({
              id,
              label,
              disabled,
              onClick: () => callAction(action),
            });
          }
        }
      }
    }
    return options;
  }, [actions, callAction, t]);

  const reservedKeyCodes = useMemo(
    () =>
      actions.edit
        .filter((a) => a.keycode && !a.disabled)
        .reduce((obj, action) => {
          obj[action.keycode!] = action;
          return obj;
        }, {} as { [keycode: string]: SketchAction }),
    [actions.edit]
  );

  const [{ canDrop, isOver }, drop] = useDrop(() => ({
    // The type (or types) to accept - strings or symbols
    accept: ["SketchFolder", "Sketch"],
    canDrop: (item, monitor) => {
      return (
        monitor.isOver({ shallow: true }) === true &&
        (Boolean(item.collectionId) || Boolean(item.folderId))
      );
    },
    // Props to collect
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (
      item: {
        id: number;
        type: string;
        folderId?: number | null;
        collectionId?: number | null;
      },
      monitor: DropTargetMonitor<{ id: number; type: string }>
    ) => {
      if (!monitor.didDrop()) {
        (item.type === "SketchFolder" ? dropFolder : dropSketch)(item.id, {
          folderId: null,
          collectionId: null,
        });
      }
    },
  }));

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      drop(el);
      setTocContainer(el);
    },
    [drop, setTocContainer]
  );

  const onSelect = useCallback(
    (metaKey, item, isSelected) => {
      if (isSelected) {
        setSelectedIds([item.id]);
      } else {
        setSelectedIds([]);
      }
    },
    [setSelectedIds]
  );

  const onExpand = useCallback(
    (item, isExpanded) => {
      setExpandedIds((prev) => [
        ...prev.filter((id) => id !== item.id),
        ...(isExpanded ? [item.id] : []),
      ]);
    },
    [setExpandedIds]
  );

  const treeRenderFn = useCallback(
    ({
      node,
      ...props
    }: TreeNodeProps<FolderNodeDataProps | SketchNodeDataProps>) => {
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

  if (!user) {
    return <LoginPrompt hidden={hidden} />;
  }

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
      <div
        ref={setRef}
        className={
          isOver && canDrop
            ? "border-blue-200 rounded-md border pt-2 pl-5 bg-blue-50"
            : "pt-2 pl-5 border border-transparent"
        }
      >
        {contextMenu?.target &&
          // onActionSelected &&
          actions &&
          actions.edit.length > 0 && (
            <ContextMenuDropdown
              options={contextMenuOptions}
              target={contextMenu.target}
              offsetX={contextMenu.offsetX}
            />
          )}
        <div>
          {!data && loading && (
            <div className="pt-2 space-y-2">
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
            </div>
          )}
          {data && (
            <TreeView
              onExpand={onExpand}
              expanded={expandedIds}
              onSelect={onSelect}
              selection={selectedIds}
              setContextMenu={setContextMenu}
              contextMenuItemId={contextMenu?.id}
              items={treeItems}
              render={treeRenderFn}
              ariaLabel="My Sketches"
            />
          )}
        </div>
      </div>
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
            focusOnTableOfContentsItem(
              "sketch",
              item.id,
              item.folderId || undefined,
              item.collectionId || undefined
            );
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
