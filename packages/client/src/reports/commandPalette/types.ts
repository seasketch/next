import { ReactNode } from "react";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

export type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: ReactNode;
  isEnabled?: (state: EditorState) => boolean;
  run: (
    state: EditorState,
    dispatch: (tr: Transaction) => void,
    view: EditorView
  ) => void;
};

export type CommandPaletteGroup = {
  id: string;
  label: string;
  items: CommandPaletteItem[];
};

