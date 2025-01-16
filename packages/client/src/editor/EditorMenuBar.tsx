import { EditorView } from "prosemirror-view";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { setBlockType, toggleMark } from "prosemirror-commands";
import {
  Fragment,
  Mark,
  MarkType,
  Node,
  Schema,
  Slice,
} from "prosemirror-model";
import { forumPosts } from "./config";
import { EditorState, Transaction } from "prosemirror-state";
import { markActive } from "./utils";
import TextInput from "../components/TextInput";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import { wrapInList } from "prosemirror-schema-list";
import ShareSketchesModal from "../projects/Forums/ShareSketchesModal";
import {
  MapBookmarkDetailsFragment,
  SketchFolderDetailsFragment,
  SketchTocDetailsFragment,
  FileUploadDetailsFragment,
  UploaderResponse,
  useUpdateMetadataFromXmlMutation,
} from "../generated/graphql";
import { sketchType } from "./config";
import { ChevronDownIcon } from "@heroicons/react/outline";
import { SketchUIStateContext } from "../projects/Sketches/SketchUIStateContextProvider";
import { MapContext } from "../dataLayers/MapContextManager";
import useDialog from "../components/useDialog";
import { treeItemId } from "../components/TreeView";
import { currentSidebarState } from "../projects/ProjectAppSidebar";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import axios from "axios";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../components/Menubar";
import { ImageIcon, UploadIcon } from "@radix-ui/react-icons";
require("../admin/data/GLStyleEditor/RadixDropdown.css");

interface EditorMenuBarProps {
  state?: EditorState;
  view?: EditorView;
  className?: string;
  style?: any;
  schema: Schema;
  createMapBookmark?: () => Promise<MapBookmarkDetailsFragment>;
  createFileUpload?: (
    filename: string,
    sizeBytes: number,
    contentType: string
  ) => Promise<UploaderResponse | null>;
  onUseServiceMetadata?: () => void;
  dynamicMetadataAvailable?: boolean;
  showUploadOption?: boolean;
  children?: ReactNode;
  tocId?: number;
  onUploadMetadataClick?: () => void;
  createImageUpload?: (
    file: File,
    altText?: string
  ) => Promise<{ error?: string; url?: string }>;
}

export default function EditorMenuBar(props: EditorMenuBarProps) {
  const [menuState, setMenuState] = useState<any>({});
  const schema = props.schema;
  const { t } = useTranslation("admin");
  const [linkModalState, setLinkModalState] = useState<{
    href: string;
    title?: string;
  } | null>(null);
  const [chooseSketchesOpen, setChooseSketchesOpen] = useState(false);
  const mapContext = useContext(MapContext);
  const [disableSharing, setDisableSharing] = useState(false);
  const dialog = useDialog();
  const { isSmall } = currentSidebarState();
  const onError = useGlobalErrorHandler();
  const { progress, updateProgress } = useContext(
    EditorAttachmentProgressContext
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);

  useEffect(() => {
    if (props.state) {
      // @ts-ignore
      setMenuState({
        disabled: {
          strong: !toggleMark(schema.marks.strong)(props.state),
          em: !toggleMark(schema.marks.em)(props.state),
          p: !setBlockType(schema.nodes.paragraph)(props.state),
          h1: !setBlockType(schema.nodes.heading, { level: 1 })(props.state),
          h2: !setBlockType(schema.nodes.heading, { level: 2 })(props.state),
          h3: !setBlockType(schema.nodes.heading, { level: 3 })(props.state),
          link: !toggleMark(schema.marks.link)(props.state),
          // ||
          // (props.state!.selection.empty &&
          //   !schema.marks.link.isInSet(
          //     props.state!.storedMarks || props.state!.selection.$from.marks()
          //   )),
        },
        active: {
          ...getActiveMarks(props.state, [
            schema.marks.strong,
            schema.marks.em,
            schema.marks.link,
          ]),
        },
      });
    }
  }, [props.state, setMenuState, schema]);

  const buttonClass = useCallback((active: boolean, className?: string) => {
    // eslint-disable-next-line i18next/no-literal-string
    return `overflow-hidden m-0 py-0 h-9 px-2 inline-flex items-center justify-center ${className} ${
      active ? "bg-gray-200" : ""
    }`;
  }, []);

  const sketchingContext = useContext(SketchUIStateContext);

  const onSubmitCopiedTocItems = useCallback(
    (
      sketches: SketchTocDetailsFragment[],
      folders: SketchFolderDetailsFragment[],
      copiedSketches: number[]
    ) => {
      if (props.view) {
        setChooseSketchesOpen(false);
        insertTocItems(
          sketches,
          folders,
          props.view?.state,
          props.view?.dispatch
        );
        const parent = [...sketches, ...folders].find(
          (item) => !item.folderId && !item.collectionId
        );
        if (sketchingContext && parent) {
          sketchingContext.hideSketches(
            copiedSketches.map((id) => treeItemId(id, "Sketch"))
          );
          sketchingContext.showSketches(
            sketches.map(({ id }) => treeItemId(id, "Sketch"))
          );
        }
      }
    },
    [props.view, sketchingContext]
  );

  const [contextMenuTarget, setContextMenuTarget] =
    useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (contextMenuTarget) {
      const clickHandler = () => setContextMenuTarget(null);
      document.body.addEventListener("click", clickHandler);
      return () => {
        document.body.removeEventListener("click", clickHandler);
      };
    }
  }, [contextMenuTarget]);

  return (
    <div
      style={{ ...props.style }}
      className={`${props.className} text-sm px-2 flex items-center`}
    >
      {imageModalOpen && props.createImageUpload && (
        <ImageModal
          onRequestClose={() => setImageModalOpen(false)}
          onSubmit={async (f, alt) => {
            const result = await props.createImageUpload!(f, alt);
            if (result.error) {
              alert(result.error);
            } else {
              setImageModalOpen(false);
            }
          }}
        />
      )}
      <button
        title={t("Bold")}
        disabled={menuState?.disabled?.strong}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          toggleMark(schema.marks.strong)(
            props.view!.state,
            props.view?.dispatch
          );
          return false;
        }}
        className={buttonClass(menuState?.active?.strong, "font-bold")}
      >
        <span className="w-3">
          {
            // eslint-disable-next-line
          }
          B
        </span>
      </button>
      <button
        title={t("Italics")}
        disabled={menuState?.disabled?.em}
        className={buttonClass(menuState?.active?.em, "italic font-serif")}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          toggleMark(schema.marks.em)(props.view!.state, props.view?.dispatch);
          return false;
        }}
      >
        <span className="w-3">
          {
            // eslint-disable-next-line
          }
          I
        </span>
      </button>
      <button
        title={t("Paragraph")}
        disabled={menuState?.disabled?.p}
        className={buttonClass(menuState?.active?.p, "")}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.paragraph)(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        <span className="w-3">
          {
            // eslint-disable-next-line
          }
          ¶
        </span>
      </button>

      <button
        title={t("Level 1 Heading")}
        disabled={menuState?.disabled?.h1}
        className={buttonClass(false, `font-medium`)}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.heading, { level: 1 })(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        <span className="w-5">
          {
            // eslint-disable-next-line
          }
          H1
        </span>
      </button>
      <button
        title={t("Level 2 Heading")}
        disabled={menuState?.disabled?.h2}
        className={buttonClass(false, `font-medium`)}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.heading, { level: 2 })(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        <span className="w-5">
          {
            // eslint-disable-next-line
          }
          H2
        </span>
      </button>
      <button
        title={t("Level 3 Heading")}
        disabled={menuState?.disabled?.h3}
        className={buttonClass(false, `font-medium`)}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          setBlockType(schema.nodes.heading, { level: 3 })(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        <span className="w-5">
          {
            // eslint-disable-next-line
          }
          H3
        </span>
      </button>
      <button
        title={t("List")}
        // disabled={menuState?.disabled?.}
        className={buttonClass(false, "")}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          wrapInList(schema.nodes.bullet_list)(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 20 20"
          strokeWidth={1.5}
          stroke="currentColor"
          className={`w-5 h-5 -mt-1 ${
            menuState?.disabled?.bulletList
              ? "text-gray-400 pointer-events-none"
              : "text-gray-800"
          }`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      </button>
      <button
        title={t("Numbered list")}
        className={buttonClass(false, "")}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          wrapInList(schema.nodes.ordered_list)(
            props.state!,
            props.view!.dispatch
          );
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
          viewBox="0 0 420 420"
          strokeWidth={1.5}
          stroke="text-black"
          className={`w-5 h-4 mt-0.5 ${
            menuState?.disabled?.bulletList
              ? "text-gray-400 pointer-events-none"
              : "text-gray-800"
          }`}
        >
          <g>
            <path
              d="M121.203,37.858c0-7.791,6.319-14.103,14.104-14.103H367.2c7.784,0,14.104,6.312,14.104,14.103
		s-6.312,14.103-14.104,14.103H135.307C127.522,51.961,121.203,45.649,121.203,37.858z M135.307,120.908h150.426
		c7.79,0,14.104-6.315,14.104-14.104c0-7.79-6.313-14.103-14.104-14.103H135.307c-7.785,0-14.104,6.307-14.104,14.103
		C121.203,114.598,127.522,120.908,135.307,120.908z M367.2,269.75H135.307c-7.785,0-14.104,6.312-14.104,14.104
		c0,7.79,6.319,14.103,14.104,14.103H367.2c7.784,0,14.104-6.312,14.104-14.103C381.304,276.062,374.984,269.75,367.2,269.75z
		 M285.727,338.693h-150.42c-7.785,0-14.104,6.307-14.104,14.104c0,7.79,6.319,14.103,14.104,14.103h150.426
		c7.79,0,14.104-6.312,14.104-14.103C299.836,345.005,293.517,338.693,285.727,338.693z M33.866,127.838h22.387V14.405H37.921
		c-0.521,5.925-0.068,10.689-4.696,14.277c-4.631,3.591-14.363,5.382-23.158,5.382H6.871v15.681h26.995V127.838z M25.603,345.147
		l28.115-20.912c9.69-6.655,16.056-12.826,19.109-18.524c3.05-5.697,4.569-11.821,4.569-18.377c0-10.716-3.585-19.357-10.737-25.941
		c-7.161-6.579-16.568-9.865-28.23-9.865c-11.245,0-20.241,3.328-26.982,9.989c-6.75,6.655-10.113,16.691-10.113,30.115H23.02
		c0-8.015,1.416-13.548,4.253-16.621c2.834-3.067,6.721-4.604,11.665-4.604s8.854,1.561,11.741,4.676
		c2.888,3.12,4.327,6.998,4.327,11.632c0,4.628-1.336,8.808-4.02,12.555c-2.675,3.747-10.125,10.071-22.352,18.962
		c-10.453,7.648-24.154,16.964-28.393,23.726L0,364.96h77.632v-19.813H25.603L25.603,345.147z"
            />
          </g>
        </svg>
      </button>
      <button
        className={
          buttonClass(menuState?.active?.link, "font-medium")
          // menuState?.disabled?.link ? "text-gray-500 pointer-events-none" : ""
        }
        disabled={menuState?.disabled?.link}
        onClick={(e) => {
          e.preventDefault();
          props.view!.focus();
          // const linkMarks = marks(props.state!, schema.marks.link);
          if (markActive(props.state!, schema.marks.link)) {
            toggleMark(schema.marks.link)(
              props.view!.state,
              props.view?.dispatch
            );
          } else {
            setLinkModalState({
              href: "https://",
              title: "",
            });
          }
        }}
      >
        <svg
          className={`w-5 h-5 mt-0.5 -mr-0.5 ${
            menuState?.disabled?.link
              ? "text-gray-400 pointer-events-none"
              : "text-gray-800"
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 22 22"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {props.createImageUpload && (
        <button
          className={buttonClass(false, "")}
          onClick={() => setImageModalOpen(true)}
        >
          <ImageIcon />
        </button>
      )}
      {props.showUploadOption && props.onUploadMetadataClick && (
        <button
          onClick={props.onUploadMetadataClick}
          className={buttonClass(false, "")}
          title="Upload XML metadata in FGDC or ISO19139 format"
        >
          <UploadIcon />
        </button>
      )}

      {(schema.nodes.sketches || schema.marks.attachmentLink) && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={`border rounded px-1 py-0.5 flex items-center border-gray-300 ml-1.5 ${
                disableSharing ? "opacity-50 pointer-events-none" : ""
              }`}
              disabled={disableSharing}
              // onClick={(e) => {
              //   e.preventDefault();
              //   e.stopPropagation();
              //   setContextMenuTarget(e.currentTarget as HTMLButtonElement);
              // }}
            >
              {isSmall ? t("Share") : t("Share content")}{" "}
              <ChevronDownIcon className="w-4 h-4 ml-1" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="end"
              className={
                MenuBarContentClasses +
                " ToCMenuContent text-sm DropdownMenuContent"
              }
              style={{ backdropFilter: "blur(3px)", minWidth: 150 }}
            >
              {schema.nodes.sketch && (
                <DropdownMenu.Item
                  className={MenuBarItemClasses}
                  onSelect={() => {
                    setChooseSketchesOpen(true);
                  }}
                >
                  <DropdownMenu.Label>{t("Sketches")}</DropdownMenu.Label>
                </DropdownMenu.Item>
              )}
              {schema.marks.attachmentLink && props.createMapBookmark && (
                <DropdownMenu.Item
                  className={MenuBarItemClasses}
                  onSelect={async () => {
                    if (mapContext.manager) {
                      const relatedSketchIds = mapContext.manager
                        .getVisibleSketchIds()
                        .filter(({ sharedInForum }) => !sharedInForum);
                      // TODO: have an option to just share these sketches from here
                      if (relatedSketchIds.length > 0) {
                        const answer = await dialog.confirm(
                          t("Unshared sketches visible on the map"),
                          {
                            description: t(
                              "You have one or more sketches visible that have not been shared. Share them first if you would like them to be visible in your bookmark."
                            ),
                            primaryButtonText: t("Create Bookmark"),
                          }
                        );
                        if (!answer) {
                          return;
                        }
                      }
                    }
                    if (props.createMapBookmark && props.view) {
                      setDisableSharing(true);
                      if (mapContext?.manager) {
                        mapContext.manager.setLoadingOverlay(
                          t("Saving map bookmark")
                        );
                      }
                      try {
                        const bookmark = await props.createMapBookmark();
                        if (mapContext?.manager) {
                          mapContext.manager.setLoadingOverlay(null);
                        }
                        setDisableSharing(false);
                        if (bookmark) {
                          props.view!.focus();
                          attachBookmark(
                            bookmark,
                            props.view.state,
                            props.view.dispatch
                          );
                          return false;
                        }
                      } catch (e) {
                        if (/Rate limit/.test(e.message)) {
                          onError(
                            new Error(
                              "Rate limited. Please try again in a few seconds."
                            )
                          );
                          setDisableSharing(false);
                          if (mapContext?.manager) {
                            mapContext.manager.setLoadingOverlay(null);
                          }
                        } else {
                          onError(e);
                          setDisableSharing(false);
                          if (mapContext?.manager) {
                            mapContext.manager.setLoadingOverlay(null);
                          }
                        }
                      }
                    }
                  }}
                >
                  <DropdownMenu.Label>{t("Map Bookmark")}</DropdownMenu.Label>
                </DropdownMenu.Item>
              )}
              {schema.marks.attachmentLink && props.createFileUpload && (
                <DropdownMenu.Item
                  className={MenuBarItemClasses}
                  onSelect={async () => {
                    var input = document.createElement("input");
                    input.type = "file";
                    input.click();
                    input.onchange = async () => {
                      if (input.files?.length) {
                        const file = input.files[0];
                        const response = await props.createFileUpload!(
                          file.name,
                          file.size,
                          file.type
                        );
                        const uploadRecord = response?.fileUpload;
                        const view = props.view;
                        if (
                          !response?.cloudflareImagesUploadUrl &&
                          uploadRecord?.presignedUploadUrl &&
                          view
                        ) {
                          props.view!.focus();
                          updateProgress(uploadRecord.id, 0);
                          attachFileUpload(
                            uploadRecord,
                            view.state,
                            view.dispatch
                          );
                          axios({
                            url: uploadRecord.presignedUploadUrl,
                            method: "PUT",
                            data: file,
                            headers: {
                              "Content-Type": file.type,
                              "Content-Disposition": `attachment; filename="${uploadRecord.filename}"`,
                              "Cache-Control":
                                "public, immutable, max-age=31536000",
                            },
                            onUploadProgress: (progressEvent) => {
                              updateProgress(
                                uploadRecord.id,
                                progressEvent.loaded / progressEvent.total
                              );
                            },
                          })
                            .then(() => {
                              updateProgress(uploadRecord.id, 1);
                            })
                            .catch((e) => {
                              onError(e);
                              deleteAttachment(
                                uploadRecord.id,
                                view.state,
                                view.dispatch
                              );
                            });
                        } else if (
                          view &&
                          uploadRecord &&
                          response?.cloudflareImagesUploadUrl
                        ) {
                          const formData = new FormData();
                          formData.append("file", file);
                          props.view!.focus();
                          updateProgress(uploadRecord.id, 0);
                          attachFileUpload(
                            uploadRecord,
                            view.state,
                            view.dispatch
                          );
                          axios({
                            url: response.cloudflareImagesUploadUrl,
                            method: "POST",
                            data: formData,
                            onUploadProgress: (progressEvent) => {
                              if (
                                progressEvent.loaded - progress.total <
                                0.95
                              ) {
                                updateProgress(
                                  uploadRecord.id,
                                  progressEvent.loaded / progressEvent.total
                                );
                              } else {
                                updateProgress(uploadRecord.id, 0.95);
                              }
                            },
                          })
                            .then(() => {
                              updateProgress(uploadRecord.id, 1);
                            })
                            .catch((e) => {
                              onError(e);
                              deleteAttachment(
                                uploadRecord.id,
                                view.state,
                                view.dispatch
                              );
                            });
                        }
                      }
                    };
                  }}
                >
                  <DropdownMenu.Label>{t("File Upload")}</DropdownMenu.Label>
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      {props.dynamicMetadataAvailable && props.onUseServiceMetadata && (
        <button className="ml-0.5" onClick={props.onUseServiceMetadata}>
          {t("Convert to dynamic service metadata")}
        </button>
      )}
      {props.children}

      {chooseSketchesOpen && (
        <ShareSketchesModal
          cancel={() => setChooseSketchesOpen(false)}
          onSubmit={onSubmitCopiedTocItems}
        />
      )}
      {!!linkModalState && (
        <Modal
          onRequestClose={() => {
            setLinkModalState(null);
          }}
          autoWidth
          title={t(`Edit Link`)}
          footer={[
            {
              variant: "primary",
              label: t("Save"),
              onClick: () => {
                toggleMark(schema.marks.link, {
                  href: linkModalState!.href,
                  title: linkModalState!.title,
                })(props.view!.state, props.view?.dispatch);
                setLinkModalState(null);
              },
            },
            {
              onClick: () => setLinkModalState(null),
              label: t("Cancel"),
            },
          ]}
        >
          <div className="w-128">
            <TextInput
              autoFocus
              name="href"
              value={linkModalState?.href || ""}
              // eslint-disable-next-line
              label="href"
              required={true}
              onChange={(href) =>
                setLinkModalState({
                  ...linkModalState,
                  href,
                })
              }
            />
          </div>
          <div className="mt-2">
            <TextInput
              name="title"
              value={linkModalState?.title || ""}
              // eslint-disable-next-line
              label="title"
              required={false}
              onChange={(title) =>
                setLinkModalState({
                  ...linkModalState!,
                  title,
                })
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export function getActiveMarks(state: EditorState, markTypes: MarkType[]) {
  const marks: { [markType: string]: boolean } = {};
  for (const mark of markTypes) {
    marks[mark.name] = markActive(state, mark);
  }
  return marks;
}

export function attachBookmark(
  bookmark: MapBookmarkDetailsFragment,
  state: EditorState,
  dispatch: (tr: Transaction) => void
) {
  let tr = state.tr;
  tr = tr.insert(
    state.doc.content.size - 1,
    forumPosts.schema.nodes.attachment.create({
      type: "MapBookmark",
      id: bookmark.id,
      data: bookmark,
    })
  );
  const selection = state.selection;
  if (selection && selection.$from.pos < selection.$to.pos) {
    tr.addMark(
      selection.from,
      selection.to,
      forumPosts.schema.marks.attachmentLink.create({
        "data-attachment-id": bookmark.id,
        "data-type": "MapBookmark",
      })
    );
  }
  dispatch(tr);
}

export function attachFileUpload(
  upload: FileUploadDetailsFragment,
  state: EditorState,
  dispatch: (tr: Transaction) => void
) {
  let tr = state.tr;
  tr = tr.insert(
    state.doc.content.size - 1,
    forumPosts.schema.nodes.attachment.create({
      type: "FileUpload",
      id: upload.id,
      data: {
        id: upload.id,
        filename: upload.filename,
        filesize: upload.fileSizeBytes,
        contentType: upload.contentType,
        downloadUrl: upload.downloadUrl,
        cloudflareImagesId: upload.cloudflareImagesId,
      },
    })
  );
  const selection = state.selection;
  if (selection && selection.$from.pos < selection.$to.pos) {
    tr.addMark(
      selection.from,
      selection.to,
      forumPosts.schema.marks.attachmentLink.create({
        "data-attachment-id": upload.id,
        "data-type": "FileUpload",
      })
    );
  }
  dispatch(tr);
}

function getAttachmentsNode(state: EditorState) {
  let attachments: Node | null = null;
  state.doc.content.forEach((node) => {
    if (node.type === forumPosts.schema.nodes.attachments) {
      attachments = node;
    }
  });
  if (attachments) {
    return attachments as Node;
  } else {
    throw new Error("Attachments node not found in prosemirror state");
  }
}

export function deleteAttachment(
  id: string,
  state: EditorState,
  dispatch: (tr: Transaction) => void
) {
  let tr = state.tr;
  // remove matching marks
  const matchingMarks = collectMarks(
    state.doc,
    forumPosts.schema.marks.attachmentLink,
    { "data-attachment-id": id }
  );
  for (const mark of matchingMarks) {
    tr = tr.removeMark(0, state.doc.content.size, mark);
  }

  // Remove bookmark from attachments
  const attachments = getAttachmentsNode(state);
  const children: Node[] = [];
  attachments.forEach((node) => {
    if (node.attrs["id"] !== id) {
      children.push(node);
    }
  });
  const newAttachments = attachments.copy(Fragment.from(children));
  tr = tr.replaceWith(
    state.doc.content.size - attachments.nodeSize,
    state.doc.content.size,
    newAttachments
  );
  dispatch(tr);
}

function collectMarks(
  doc: Node,
  type: MarkType,
  attrs: { [key: string]: number | string } = {},
  marks: Mark[] = []
) {
  for (const mark of doc.marks) {
    if (mark.type === type) {
      let matches = true;
      for (const key in attrs) {
        if (!(key in mark.attrs) || mark.attrs[key] !== attrs[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        marks.push(mark);
      }
    }
  }
  doc.forEach((node) => {
    collectMarks(node, type, attrs, marks);
  });
  return marks;
}

export function insertTocItems(
  sketches: SketchTocDetailsFragment[],
  folders: SketchFolderDetailsFragment[],
  state: EditorState,
  dispatch: (tr: Transaction) => void
) {
  const items = [...sketches, ...folders];
  const parent = items.find((item) => !item.folderId && !item.collectionId);
  const slice = new Slice(
    Fragment.from([
      sketchType.create({
        title: parent!.name,
        items: [...sketches, ...folders],
      }),
      forumPosts.schema.nodes.paragraph.create(),
    ]),
    0,
    0
  );
  dispatch(state.tr.replaceSelection(slice));
}

interface EditorAttachmentProgressContextValue {
  progress: {
    /** Value is progress, 0 to 1 */
    [attachemntId: string]: number;
  };
  updateProgress: (attachmentId: string, progress: number) => void;
}

export const EditorAttachmentProgressContext =
  createContext<EditorAttachmentProgressContextValue>({
    progress: {},
    updateProgress: () => {
      throw new Error("Not implemented");
    },
  });

export function EditorAttachmentProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<{ [attachmentId: string]: number }>({});

  const updateProgress = useCallback(
    (attachmentId: string, progress: number) => {
      if (progress > 1) {
        throw new Error("Progress should be an integer, 0 - 1");
      }
      setState((prev) => ({
        ...prev,
        [attachmentId]: progress,
      }));
    },
    [setState]
  );

  return (
    <EditorAttachmentProgressContext.Provider
      value={{ progress: state, updateProgress }}
    >
      {children}
    </EditorAttachmentProgressContext.Provider>
  );
}

function ImageModal({
  onRequestClose,
  onSubmit,
}: {
  onRequestClose: () => void;
  onSubmit: (file: File, altText?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  return (
    <Modal onRequestClose={onRequestClose} title={t("Upload Image")}>
      <p className="text-sm text-gray-500">
        <Trans>
          Choose an image to upload, along with optional alternate text for
          accessibility. You can also drag & drop images to the editor, though
          you will not be able to specify alt text that way.
        </Trans>
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const form = e.target as HTMLFormElement;
          const data = new FormData(form);
          const altText = data.get("alt-text");
          const file = data.get("image");
          if (file) {
            setSaving(true);
            await onSubmit(file as File, altText as string);
            setSaving(false);
          }
        }}
      >
        <input
          className="block text-sm py-2"
          required
          type="file"
          name="image"
          accept="image/*"
        />
        <input
          className="block w-128 border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 text-black"
          type="text"
          name="alt-text"
          placeholder="Alt text"
        />
        <div className="space-x-2 pt-4">
          <button
            className="border rounded px-2 py-0.5 border-gray-500 bg-gray-200 "
            disabled={saving}
            type="submit"
          >
            {t("Submit")}
          </button>
          <button onClick={onRequestClose}>{t("cancel")}</button>
        </div>
      </form>
    </Modal>
  );
}
