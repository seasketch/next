/* eslint-disable i18next/no-literal-string */
import { useCallback, useRef, useState } from "react";
import { Node, Schema } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { NodeSelection } from "prosemirror-state";
import * as Popover from "@radix-ui/react-popover";
import { TooltipDropdown, TooltipPopoverContent } from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { ImageLayout } from "./prosemirror/reportBodySchema";

type ImageTooltipControlsProps = {
  node: Node;
  pos: number;
  view: EditorView;
  schema: Schema;
  uploadFile: (file: File) => Promise<string>;
};

const layoutOptions = [
  { value: "center", label: "Center" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "full", label: "Full width" },
];

const widthOptions = [
  { value: "", label: "Content" },
  { value: "25", label: "25%" },
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "100", label: "100%" },
];

export default function ImageTooltipControls({
  node,
  pos,
  view,
  schema,
  uploadFile,
}: ImageTooltipControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [altPopoverOpen, setAltPopoverOpen] = useState(false);
  const [altValue, setAltValue] = useState("");

  const updateAttrs = useCallback(
    (attrs: Record<string, any>) => {
      const tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attrs,
      });
      const updatedNode = tr.doc.nodeAt(pos);
      if (updatedNode) {
        tr.setSelection(NodeSelection.create(tr.doc, pos));
      }
      view.dispatch(tr);
    },
    [view, pos, node.attrs]
  );

  const handleReplace = useCallback(async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const src = await uploadFile(file);
        updateAttrs({ src });
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [uploadFile, updateAttrs]
  );

  const handleLayoutChange = useCallback(
    (value: string) => {
      updateAttrs({ layout: value as ImageLayout });
    },
    [updateAttrs]
  );

  const handleWidthChange = useCallback(
    (value: string) => {
      updateAttrs({ width: value || null });
    },
    [updateAttrs]
  );

  const handleApplyAlt = useCallback(() => {
    updateAttrs({ alt: altValue });
    setAltPopoverOpen(false);
  }, [altValue, updateAttrs]);

  const currentLayout = (node.attrs.layout as string) || "center";
  const currentWidth = (node.attrs.width as string) || "";

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <button
        type="button"
        className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1 hover:bg-gray-100 focus:outline-none whitespace-nowrap"
        onClick={handleReplace}
        disabled={uploading}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {uploading ? (
          <span className="text-gray-500">Uploading…</span>
        ) : (
          <span>Replace image</span>
        )}
      </button>

      <div className="h-4 w-px bg-gray-200 mx-0.5" />

      <TooltipDropdown
        value={currentLayout}
        options={layoutOptions}
        onChange={handleLayoutChange}
        ariaLabel="Image layout"
        contentProps={{ "data-tooltip-dropdown": "true" } as any}
      />

      <LabeledDropdown
        label="Width"
        value={currentWidth}
        options={widthOptions}
        onChange={handleWidthChange}
        ariaLabel="Image width"
      />

      <div className="h-4 w-px bg-gray-200 mx-0.5" />

      <Popover.Root
        open={altPopoverOpen}
        onOpenChange={(open) => {
          setAltPopoverOpen(open);
          if (open) {
            setAltValue(node.attrs.alt || "");
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1 hover:bg-gray-100 focus:outline-none whitespace-nowrap data-[state=open]:bg-gray-100"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span>Alt text</span>
          </button>
        </Popover.Trigger>
        <TooltipPopoverContent side="top" sideOffset={6}>
          <div
            className="w-64"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <label className="block text-[11px] text-gray-500 mb-1">
              Alt text (describes the image for accessibility)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={altValue}
                onChange={(e) => setAltValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyAlt();
                  }
                }}
                className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe this image…"
                autoFocus
              />
              <button
                type="button"
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleApplyAlt}
              >
                Apply
              </button>
            </div>
          </div>
        </TooltipPopoverContent>
      </Popover.Root>
    </>
  );
}
