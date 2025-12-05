import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  closeSlashCommand,
  filterSlashCommandItems,
  setSlashCommandSelectedIndex,
  slashCommandPluginKey,
  SlashCommandItem,
} from "./plugin";

interface UseSlashCommandPaletteOptions {
  schema: Schema;
  editorState?: EditorState;
  viewRef: MutableRefObject<EditorView | undefined>;
  rootRef: RefObject<HTMLElement>;
  items: SlashCommandItem[];
}

interface SlashCommandPaletteState {
  slashState?: ReturnType<typeof slashCommandPluginKey.getState>;
  slashItems: SlashCommandItem[];
  selectedIndex: number;
  anchor: { top: number; left: number } | null;
  handleSelect: (item: SlashCommandItem) => void;
  handleHighlight: (index: number) => void;
}

export function useSlashCommandPalette({
  schema,
  editorState,
  viewRef,
  rootRef,
  items,
}: UseSlashCommandPaletteOptions): SlashCommandPaletteState {
  const slashState = editorState
    ? slashCommandPluginKey.getState(editorState)
    : undefined;
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null
  );

  const slashItems = useMemo(() => {
    if (!slashState?.active) {
      return [];
    }
    return filterSlashCommandItems(schema, slashState.query, items);
  }, [schema, slashState, items]);

  const selectedIndex = slashItems.length
    ? Math.min(slashState?.selectedIndex ?? 0, slashItems.length - 1)
    : 0;

  const updatePalettePosition = useCallback(() => {
    const view = viewRef.current;
    const root = rootRef.current;
    if (!view || !root || !slashState?.active || !slashState.range) {
      setAnchor(null);
      return;
    }
    try {
      const startCoords = view.coordsAtPos(slashState.range.from);
      setAnchor({
        top: startCoords.bottom + 8,
        left: startCoords.left,
      });
    } catch (err) {
      setAnchor(null);
    }
  }, [rootRef, slashState, viewRef]);

  useEffect(() => {
    if (!slashState?.active) {
      setAnchor(null);
      return;
    }
    updatePalettePosition();
    const handleScroll = () => updatePalettePosition();
    window.addEventListener("resize", updatePalettePosition);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", updatePalettePosition);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [slashState, updatePalettePosition]);

  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      const view = viewRef.current;
      if (!view || !slashState?.range) {
        return;
      }
      const executed = item.run({ view, range: slashState.range });
      if (executed) {
        closeSlashCommand(view);
      }
    },
    [slashState, viewRef]
  );

  const handleHighlight = useCallback(
    (index: number) => {
      const view = viewRef.current;
      if (!view || !slashState?.active) {
        return;
      }
      setSlashCommandSelectedIndex(view, index);
    },
    [slashState, viewRef]
  );

  return {
    slashState,
    slashItems,
    selectedIndex,
    anchor,
    handleSelect,
    handleHighlight,
  };
}
