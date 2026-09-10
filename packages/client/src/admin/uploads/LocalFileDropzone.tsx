import { ReactNode, useEffect, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import clsx from "clsx";

export type LocalFileDropzoneState = {
  isDragActive: boolean;
  draggedFileNames: string[];
};

function fileNamesFromEvent(event: {
  dataTransfer?: DataTransfer | null;
}): string[] {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    return Array.from(files).map((file) => file.name);
  }
  return [];
}

export default function LocalFileDropzone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  children,
  className,
  label,
  dragClassName = "ring-4 ring-blue-600",
  onDragStateChange,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode | ((state: LocalFileDropzoneState) => ReactNode);
  className?: string;
  label: string;
  dragClassName?: string;
  onDragStateChange?: (state: LocalFileDropzoneState) => void;
}) {
  const [draggedFileNames, setDraggedFileNames] = useState<string[]>([]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[], _rejections: FileRejection[]) => {
      setDraggedFileNames([]);
      onFiles(acceptedFiles);
    },
    onDragEnter: (event) => {
      const names = fileNamesFromEvent(event);
      setDraggedFileNames((prev) =>
        prev.length === names.length &&
        prev.every((name, index) => name === names[index])
          ? prev
          : names
      );
    },
    onDragLeave: () => {
      setDraggedFileNames([]);
    },
    accept,
    multiple,
    disabled,
    noClick: true,
    noKeyboard: true,
    noDragEventsBubbling: true,
  });

  const dragActive = isDragActive && !disabled;

  useEffect(() => {
    onDragStateChange?.({
      isDragActive: dragActive,
      draggedFileNames,
    });
  }, [dragActive, draggedFileNames, onDragStateChange]);

  const content =
    typeof children === "function"
      ? children({ isDragActive: dragActive, draggedFileNames })
      : children;

  return (
    <div
      {...getRootProps()}
      // Drop-only: do not inherit react-dropzone's role="button",
      // which makes the whole list show a pointer cursor.
      role={undefined}
      aria-label={label}
      className={clsx(className, dragActive && dragClassName)}
    >
      <input {...getInputProps()} />
      {dragActive ? (
        <span className="sr-only" aria-live="polite">
          {label}
        </span>
      ) : null}
      {content}
    </div>
  );
}
