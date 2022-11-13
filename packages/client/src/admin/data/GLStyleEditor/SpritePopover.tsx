/* eslint-disable i18next/no-literal-string */
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import { usePopper } from "react-popper";
import Spinner from "../../../components/Spinner";
import {
  SpriteDetailsFragment,
  SpritesDocument,
  useDeleteSpriteMutation,
  useGetOrCreateSpriteMutation,
  useShareSpriteMutation,
  useSpritesQuery,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import useProjectId from "../../../useProjectId";
import { getBestSpriteImage } from "./extensions/glStyleSprites";
import { EditorView } from "@codemirror/view";
import { DataUploadDropzoneContext } from "../../uploads/DataUploadDropzone";
import useIsSuperuser from "../../../useIsSuperuser";
import { CollectionIcon, ShareIcon, TrashIcon } from "@heroicons/react/outline";
import useDialog from "../../../components/useDialog";

export default function SpritePopover({
  spriteState,
  onChange,
}: {
  spriteState: null | {
    from: number;
    to: number;
    view: EditorView;
    value: string;
    target: HTMLSpanElement;
    selectedSpriteId: number | null;
  };
  onChange: (selectedSpriteId: number | null, value?: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [createSprite, mutationState] = useGetOrCreateSpriteMutation();
  const projectId = useProjectId();
  const spriteQuery = useSpritesQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const selectedSprite = useMemo(() => {
    if (!spriteState?.selectedSpriteId) {
      return null;
    }
    const allSprites = [
      ...(spriteQuery.data?.projectBySlug?.sprites || []),
      ...(spriteQuery.data?.publicSprites || []),
    ];
    return (
      allSprites.find((s) => s.id === spriteState?.selectedSpriteId) || null
    );
  }, [
    spriteState?.selectedSpriteId,
    spriteQuery.data?.projectBySlug,
    spriteQuery.data?.publicSprites,
  ]);

  const sprites = useMemo(() => {
    const data = [
      ...(spriteQuery.data?.projectBySlug?.sprites || []),
      ...(spriteQuery.data?.publicSprites || []),
    ].sort((a, b) => a.id - b.id);
    const sprites = {
      uploaded: data.filter((s) => Boolean(s.projectId)),
      byCategory: data.reduce((categories, sprite) => {
        if (!Boolean(sprite.projectId)) {
          const category = sprite.category || "uncategorized";
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push(sprite);
        }
        return categories;
      }, {} as { [category: string]: SpriteDetailsFragment[] }),
    };
    return sprites;
  }, [spriteQuery.data]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (selectedCategory !== null && selectedCategory !== "uploads") {
        setSelectedCategory(null);
      }
      try {
        await Promise.all(
          acceptedFiles.map(async (file) => {
            const dims = await getImageDimensions(file);
            if (dims.height > 512 || dims.width > 512) {
              await alert(
                `${file.name} is too large (${dims.width}x${dims.height}). We recommend marker images to be ~32x32px. Fill patterns may be up to 512px.`
              );
            } else if (
              ["image/png", "image/jpeg", "image/jpg"].indexOf(file.type) === -1
            ) {
              await alert(
                `${file.name} is not a recognized file type. Should be png or jpg.`
              );
            } else {
              setUploadPlaceholders((prev) => [
                ...(prev || []),
                {
                  file,
                },
              ]);
              await createSprite({
                variables: {
                  height: dims.height,
                  width: dims.height,
                  pixelRatio: 2,
                  projectId: projectId!,
                  smallestImage: file,
                },
              });
              setUploadPlaceholders((prev) => {
                return [...(prev || []).filter((f) => f.file !== file)];
              });
            }
          })
        );
        spriteQuery.refetch();
      } catch (e) {
        setUploadPlaceholders([]);
        alert((e as Error).message);
      }
    },
    [createSprite, projectId, spriteQuery]
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null);
  const { styles, attributes } = usePopper(spriteState?.target, popperElement, {
    modifiers: [{ name: "arrow", options: { element: arrowElement } }],
  });
  const uploadContext = useContext(DataUploadDropzoneContext);

  const [share, shareMutationState] = useShareSpriteMutation();

  const superuser = useIsSuperuser();
  const { confirm, alert } = useDialog();
  const [selectedCategory, setSelectedCategory] = useState<
    null | "uploads" | string
  >(null);

  useEffect(() => {
    if (spriteState?.target) {
      uploadContext.setDisabled(true);
    } else {
      uploadContext.setDisabled(false);
    }
  }, [spriteState?.target]);

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (spriteState) {
        const target = e.target as HTMLElement;
        if (
          e.target &&
          popperElement &&
          (popperElement.contains(target) ||
            (target.nodeName === "SPAN" && target.dataset.sprite))
        ) {
          // do nothing. clicking within popup or the decoration
        } else {
          onChange(null);
        }
      }
    };
    document.addEventListener("click", listener);
    return () => {
      document.removeEventListener("click", listener);
    };
  });

  const onSpriteClick = useCallback(
    (sprite: SpriteDetailsFragment) => {
      if (spriteState?.view) {
        const insert = `"seasketch://sprites/${sprite.id}"`;
        onChange(sprite.id, insert);
        spriteState.view.dispatch({
          changes: {
            from: spriteState.from,
            to: spriteState.to,
            insert,
          },
        });
      }
    },
    [onChange, spriteState?.from, spriteState?.to, spriteState?.view]
  );

  const [softDelete, deleteMutationState] = useDeleteSpriteMutation();

  const [uploadPlaceholders, setUploadPlaceholders] =
    useState<{ file: File }[]>();

  if (!spriteState) {
    return null;
  }

  return (
    <div
      ref={setPopperElement}
      style={styles.popper}
      {...attributes.popper}
      className="bg-cool-gray-700 rounded shadow-lg z-10 border border-black border-opacity-30 flex flex-col-reverse"
    >
      {selectedSprite &&
        (() => {
          const image = getBestSpriteImage(selectedSprite);
          return (
            <div className="flex space-x-2 items-center p-3 border-gray-800 bg-gray-800 bg-opacity-20 pt-3">
              <img
                src={image.url}
                width={image.width / image.pixelRatio}
                height={image.height / image.pixelRatio}
              />
              <div className="text-gray-200 text-xs flex-1">
                <span>
                  {image.width}px × {image.height}px
                </span>
              </div>
              {superuser && (
                <button
                  title={
                    selectedSprite.projectId
                      ? "share sprite"
                      : "change category"
                  }
                  onClick={async () => {
                    const category = await prompt(
                      "Enter the category for this sprite",
                      selectedSprite.category
                        ? selectedSprite.category
                        : undefined
                    );
                    if (category) {
                      share({
                        variables: {
                          id: selectedSprite.id,
                          category,
                        },
                      });
                    }
                  }}
                >
                  {selectedSprite.projectId ? (
                    <ShareIcon className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <CollectionIcon className="w-5 h-5 text-indigo-400" />
                  )}
                </button>
              )}
              {(superuser || selectedSprite.projectId) && (
                <button
                  title="delete sprite"
                  onClick={async () => {
                    if (
                      await confirm(
                        "Deleting this sprite will remove it from the list of available sprites, but it will be retained if referenced by any existing map styles."
                      )
                    ) {
                      await softDelete({
                        variables: {
                          id: selectedSprite.id,
                        },
                        refetchQueries: [SpritesDocument],
                      });
                    }
                  }}
                >
                  <TrashIcon className="w-5 h-5 text-indigo-400" />
                </button>
              )}
            </div>
          );
        })()}
      <div className="flex-1  p-2">
        {/* <input className="hidden pointer-events-none" {...getInputProps()} /> */}
        <select
          className="text-xs py-1 pl-1 bg-gray-700 w-full rounded text-gray-400 mb-2"
          onChange={(e) => {
            if (e.target.value === "all") {
              setSelectedCategory(null);
            } else {
              setSelectedCategory(e.target.value);
            }
          }}
        >
          <option value="all">all sprites</option>
          <option value="uploads">project uploads</option>
          {Object.keys(sprites.byCategory).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {spriteQuery.loading && !spriteQuery.data && <Spinner />}
        {sprites && (
          <div
            {...getRootProps()}
            className="w-64 h-48 items-center cursor-default"
            role=""
          >
            {isDragActive && (
              <div className="z-20 absolute left-0 top-0 w-full h-full flex items-center justify-center bg-indigo-600 bg-opacity-20"></div>
            )}
            {(selectedCategory === null || selectedCategory === "uploads") && (
              <>
                <h4 className="text-xs text-gray-200 py-1">project uploads</h4>
                {sprites.uploaded.map((sprite) => (
                  <SpriteItem
                    key={sprite.id}
                    sprite={sprite}
                    selected={sprite.id === spriteState.selectedSpriteId}
                    onClick={onSpriteClick}
                  />
                ))}
                {uploadPlaceholders &&
                  uploadPlaceholders.length > 0 &&
                  uploadPlaceholders.map(({ file }) => {
                    return <UploadPlaceholder key={file.name} file={file} />;
                  })}
                {sprites.uploaded.length === 0 &&
                  (uploadPlaceholders || []).length === 0 && (
                    <p className="text-xs p-1.5 bg-gray-600 rounded text-gray-400">
                      {isDragActive
                        ? "Drop new sprites here ..."
                        : `None. Drag & drop PNG images here. Recommended size is ~32x32
                pixels.`}
                    </p>
                  )}
              </>
            )}
            {(selectedCategory === null || selectedCategory !== "uploads") &&
              (selectedCategory === null
                ? Object.keys(sprites.byCategory)
                : [selectedCategory]
              ).map((category) => {
                return (
                  <div key={category} className="clear-both">
                    <h4 className="text-xs text-gray-200 py-1">{category}</h4>
                    {sprites.byCategory[category].map((sprite) => (
                      <SpriteItem
                        key={sprite.id}
                        sprite={sprite}
                        selected={sprite.id === spriteState.selectedSpriteId}
                        onClick={onSpriteClick}
                      />
                    ))}
                  </div>
                );
              })}
          </div>
        )}
        <div ref={setArrowElement} style={styles.arrow} className="z-10" />
      </div>
    </div>
  );
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number; type: string }> {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (e: any) {
      var image = new Image();
      image.src = e.target.result;
      image.onload = function () {
        resolve({
          type: file.type,
          width: image.width,
          height: image.height,
        });
      };
    };
  });
}

const SpriteItem = memo(
  ({
    sprite,
    selected,
    onClick,
  }: {
    sprite: SpriteDetailsFragment;
    selected: boolean;
    onClick: (sprite: SpriteDetailsFragment) => void;
  }) => {
    const image = getBestSpriteImage(sprite);
    return (
      <div
        key={sprite.id}
        className={`float-left w-8 h-8 cursor-pointer flex items-center  ${
          selected
            ? "border border-gray-600"
            : "hover:bg-black hover:bg-opacity-10"
        }`}
        style={{
          backgroundImage: `url(${image.url})`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: `${image.width / image.pixelRatio}px auto`,
        }}
        onClick={() => onClick(sprite)}
      ></div>
    );
  }
);

const UploadPlaceholder = memo(({ file }: { file: File }) => {
  const ref = useRef<any>();

  useEffect(() => {
    const fileReader = new FileReader();

    fileReader.onload = async () => {
      if (ref.current) {
        const { width } = await getImageDimensions(file);
        const div = ref.current as HTMLDivElement;
        div.style.backgroundImage = `url(${fileReader.result})`;
        div.style.backgroundSize = `${width / 2}px auto`;
      }
    };
    fileReader.readAsDataURL(file);
  }, [file]);
  return (
    <div
      className={`float-left w-8 h-8 flex justify-center items-center hover:bg-black hover:bg-opacity-10 saturate-0 relative`}
    >
      <div
        ref={ref}
        className="absolute left-0 top-0 w-full h-full saturate-0 opacity-20"
        style={{
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: `cover`,
        }}
      ></div>
      <Spinner className="w-4 h-4 p-0 m-0" />
    </div>
  );
});
