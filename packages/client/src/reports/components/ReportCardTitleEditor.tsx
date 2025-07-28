import { useState, useEffect, useRef } from "react";

interface ReportCardTitleEditorProps {
  title: string;
  onUpdate: (newTitle: string) => void;
  className?: string;
}

export default function ReportCardTitleEditor({
  title,
  onUpdate,
  className = "",
}: ReportCardTitleEditorProps) {
  const [editingTitle, setEditingTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local state when title prop changes
  useEffect(() => {
    setEditingTitle(title);
  }, [title]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editingTitle.trim() !== title) {
        onUpdate(editingTitle.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingTitle(title); // Reset to original
    }
  };

  const handleBlur = () => {
    if (editingTitle.trim() !== title) {
      onUpdate(editingTitle.trim());
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editingTitle}
      onChange={(e) => setEditingTitle(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`font-medium flex-1 bg-transparent border-none outline-none p-0 m-0 ${className}`}
      style={{ fontFamily: "inherit", fontSize: "inherit" }}
    />
  );
}
