import React from "react";
import { useTextSelection } from "@/hooks/useTextSelection";

type Props = {
  rootRef: React.MutableRefObject<HTMLDivElement | null>;
};

/**
 * Encapsulates text‑selection highlight logic and communicates with parent window.
 */
export const Highlights: React.FC<Props> = ({ rootRef }) => {
  const { selection, applyHighlight, removeHighlight } =
    useTextSelection(rootRef);

  // Notify parent about current selection
  React.useEffect(() => {
    if (!selection.isActive || !selection.rect) return;
    window.parent.postMessage(
      {
        type: "TEXT_SELECTED",
        rect: selection.rect,
        selectedText: selection.text,
      },
      "*",
    );
  }, [selection]);

  // Listen for highlight commands
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d?.type) return;
      if (d.type === "HIGHLIGHT_TEXT") applyHighlight(d.color);
      if (d.type === "REMOVE_HIGHLIGHT") {
        const el = rootRef.current?.querySelector(
          `[data-highlight-id="${d.highlightId}"]`,
        );
        if (el) removeHighlight(el as HTMLElement);
      }
      if (d.type === "COPY_SELECTION" && selection.text)
        navigator.clipboard.writeText(selection.text);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [applyHighlight, removeHighlight, selection]);

  return null;
};
