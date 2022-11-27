import Button from "../../components/Button";
import DropdownButton, {
  DropdownOption,
} from "../../components/DropdownButton";
import {
  ProjectAppSidebarContext,
  ProjectAppSidebarToolbar,
} from "../ProjectAppSidebar";
import { Trans as I18n } from "react-i18next";
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
import useSketchActions, { SketchAction } from "./useSketchActions";
import { useApolloClient } from "@apollo/client";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useLocalStorage from "../../useLocalStorage";
import { useAuth0 } from "@auth0/auth0-react";
import { HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY } from "../../auth/JoinProject";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default memo(function SketchingTools({ hidden }: { hidden?: boolean }) {
  const { data, loading } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const { isSmall } = useContext(ProjectAppSidebarContext);
  const { user, loginWithRedirect } = useAuth0();

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

  const [selectedSketchIds, setSelectedSketchIds] = useState<number[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [expandedSketchIds, setExpandedSketchIds] = useLocalStorage<number[]>(
    `expanded-sketch-ids-${getSlug}`,
    []
  );
  const [expandedFolderIds, setExpandedFolderIds] = useLocalStorage<number[]>(
    `expanded-sketch-ids-${getSlug}`,
    []
  );
  const [toolbarRef, setToolbarRef] = useState<HTMLDivElement | null>(null);
  const [tocContainer, setTocContainer] = useState<HTMLDivElement | null>(null);
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
      if (selectedFolderIds.length) {
        setSelectedFolderIds([]);
      }
      if (selectedSketchIds.length) {
        setSelectedSketchIds([]);
      }
      return true;
    };
    document.body.addEventListener("click", handler);
    return () => {
      document.body.removeEventListener("click", handler);
    };
  }, [tocContainer, toolbarRef, setSelectedFolderIds, setSelectedSketchIds, selectedFolderIds.length, selectedSketchIds.length]);

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
    (
      type: "sketch" | "folder",
      id: number,
      folderId?: number | null,
      collectionId?: number | null
    ) => {
      if (folderId) {
        setExpandedFolderIds((prev) => [
          ...prev.filter((f) => f !== folderId),
          folderId,
        ]);
      }
      if (collectionId) {
        setExpandedSketchIds((prev) => [
          ...prev.filter((s) => s !== collectionId),
          collectionId,
        ]);
      }

      setSelectedFolderIds(type === "folder" ? [id] : []);
      setSelectedSketchIds(type === "sketch" ? [id] : []);
    },
    [setExpandedFolderIds, setExpandedSketchIds]
  );

  const callAction = useCallback(
    (action: SketchAction) => {
      action.action({
        selectedSketches: selectedSketchIds.map(
          (id) =>
            (data?.projectBySlug?.mySketches || []).find((s) => s.id === id)!
        ),
        selectedFolders: selectedFolderIds.map(
          (id) =>
            (data?.projectBySlug?.myFolders || []).find((f) => f.id === id)!
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
          setSelectedFolderIds([]);
          setSelectedSketchIds([]);
        },
      });
    },
    [
      client,
      data?.projectBySlug?.myFolders,
      data?.projectBySlug?.mySketches,
      focusOnTableOfContentsItem,
      onError,
      selectedFolderIds,
      selectedSketchIds,
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

  if (!user) {
    return (
      <div style={{ display: hidden ? "none" : "block" }}>
        <h2 className="p-4">
          <Trans>
            Please{" "}
            <button
              className="underline text-primary-500"
              onClick={() => {
                const hasSkippedJoinPrompt = localStorage.getItem(
                  HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY
                );
                loginWithRedirect({
                  appState: {
                    returnTo:
                      hasSkippedJoinPrompt === "true"
                        ? window.location.pathname
                        : window.location.pathname + "?pj",
                    promptToJoin: true,
                  },
                  redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
                });
              }}
            >
              sign in
            </button>{" "}
            or{" "}
            <button
              className="underline text-primary-500"
              onClick={() => {
                const hasSkippedJoinPrompt = localStorage.getItem(
                  HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY
                );
                loginWithRedirect({
                  screen_hint: "signup",
                  appState: {
                    returnTo:
                      hasSkippedJoinPrompt === "true"
                        ? window.location.pathname
                        : window.location.pathname + "?pj",
                    promptToJoin: true,
                  },
                  redirectUri: `${window.location.protocol}//${window.location.host}/authenticate`,
                });
              }}
            >
              create an account
            </button>{" "}
            to start creating sketches.
          </Trans>
        </h2>
      </div>
    );
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
      <DndProvider backend={HTML5Backend}>
        <SketchTableOfContents
          reservedKeyCodes={Object.keys(reservedKeyCodes)}
          onReservedKeyDown={(key, focus) => {
            const action = reservedKeyCodes[key];
            if (action && !action.disabled) {
              callAction(action);
            }
          }}
          ref={(tocContainer) => setTocContainer(tocContainer)}
          folders={data?.projectBySlug?.myFolders || []}
          sketches={data?.projectBySlug?.mySketches || []}
          loading={loading}
          selectedFolderIds={selectedFolderIds}
          selectedSketchIds={selectedSketchIds}
          expandedFolderIds={expandedFolderIds}
          expandedSketchIds={expandedSketchIds}
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
          onExpandedChange={(item, isExpanded) => {
            if (item.__typename === "SketchFolder") {
              setExpandedFolderIds((prev) => [
                ...prev.filter((f) => f !== item.id),
                ...(isExpanded ? [item.id] : []),
              ]);
            } else {
              setExpandedSketchIds((prev) => [
                ...prev.filter((f) => f !== item.id),
                ...(isExpanded ? [item.id] : []),
              ]);
            }
          }}
          actions={actions}
          onActionSelected={callAction}
        />
      </DndProvider>
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
