import { ClipboardCopyIcon } from "@heroicons/react/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "../projects/Forums/InlineAuthorDetails";

export default function CopyLinkField({ url }: { url: string }) {
  const { t } = useTranslation("mapBookmarks");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      copyTextToClipboard(url);
    }
    setCopied(true);
  };

  return (
    <div className="relative">
      <input
        readOnly
        value={url}
        aria-label={t("Link")}
        onClick={() => {
          void copy();
        }}
        className="w-full cursor-pointer truncate rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-[4.5rem] font-mono text-xs text-slate-600 shadow-none focus:border-slate-300 focus:outline-none focus:ring-0"
      />
      <span className="absolute inset-y-1 right-1 flex items-center">
        <button
          type="button"
          className="inline-flex h-full items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900"
          onClick={(event) => {
            event.stopPropagation();
            void copy();
          }}
        >
          <ClipboardCopyIcon className="h-3.5 w-3.5" />
          {t("Copy")}
        </button>
        <AnimatePresence>
          {copied && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
            >
              {t("Copied")}
              <span
                aria-hidden
                className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-slate-950"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}
