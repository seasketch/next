/* eslint-disable i18next/no-literal-string */
import { useCallback, useContext, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { usePopper } from "react-popper";
import Spinner from "../../../components/Spinner";
import {
  useGetOrCreateSpriteMutation,
  useSpritesQuery,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import useProjectId from "../../../useProjectId";
import { getBestSpriteImage } from "./extensions/glStyleSprites";
import { EditorView } from "@codemirror/view";
import { DataUploadDropzoneContext } from "../../uploads/DataUploadDropzone";

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
    selectedSpriteId: number;
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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      await Promise.all(
        acceptedFiles.map(async (file) => {
          const dims = await getImageDimensions(file);
          await createSprite({
            variables: {
              height: dims.height,
              width: dims.height,
              pixelRatio: 2,
              projectId: projectId!,
              smallestImage: file,
            },
          });
        })
      );
      spriteQuery.refetch();
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

  useEffect(() => {
    if (spriteState?.target) {
      uploadContext.setDisabled(true);
    } else {
      uploadContext.setDisabled(false);
    }
  }, [spriteState?.target, uploadContext]);

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

  if (!spriteState) {
    return null;
  }

  return (
    <div
      ref={setPopperElement}
      style={styles.popper}
      {...attributes.popper}
      className="bg-cool-gray-700 p-2 rounded shadow-lg z-10 border border-black border-opacity-30"
    >
      {/* <input className="hidden pointer-events-none" {...getInputProps()} /> */}
      <select className="text-xs py-1 pl-1 bg-gray-600 w-full rounded text-white mb-2">
        <option value="project">all sprites</option>
      </select>
      {spriteQuery.loading && !spriteQuery.data && <Spinner />}
      {spriteQuery.data && (
        <div {...getRootProps()} className="w-64 h-48 items-center">
          {isDragActive && (
            <div className="z-10 absolute left-0 top-0 w-full h-full flex items-center justify-center bg-indigo-600 bg-opacity-5">
              Drop new sprites here ...
            </div>
          )}
          <h4 className="text-xs text-gray-200 py-1">project uploads</h4>
          {(spriteQuery.data.projectBySlug?.sprites || []).map((sprite) => {
            const image = getBestSpriteImage(sprite);
            return (
              <div
                key={sprite.id}
                className={`float-left w-8 h-8 cursor-pointer flex items-center  ${
                  sprite.id === spriteState.selectedSpriteId
                    ? "border border-gray-600"
                    : "hover:bg-black hover:bg-opacity-10"
                }`}
                style={{
                  backgroundImage: `url(${image.url})`,
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${image.width / image.pixelRatio}px ${
                    image.height / image.pixelRatio
                  }px`,
                }}
                onClick={() => {
                  if (spriteState.view) {
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
                }}
              ></div>
            );
          })}
        </div>
      )}
      <div ref={setArrowElement} style={styles.arrow} className="z-10" />
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
