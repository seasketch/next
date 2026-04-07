import clsx from "clsx";
import { ReactNode, useEffect, useState } from "react";
import Spinner from "./Spinner";

type JsonPreviewProps = {
  value: unknown;
  /** Scroll container; default includes `max-h-64`. Pass e.g. `max-h-[min(70vh,36rem)]` for modals. */
  className?: string;
};

/**
 * Pretty-printed JSON with syntax highlighting (same implementation as reports
 * task line items). Lazily formats with Prettier when available.
 */
export default function JsonPreview({ value, className }: JsonPreviewProps) {
  const [formattedJson, setFormattedJson] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const containerClass = clsx(
    "bg-gray-800 rounded p-2 overflow-auto",
    className ?? "max-h-64"
  );

  useEffect(() => {
    let cancelled = false;

    async function formatJSON() {
      try {
        const [prettier, babel] = await Promise.all([
          import("prettier/standalone"),
          import("prettier/parser-babel"),
        ]);

        if (cancelled) return;

        let parsedValue = value;
        if (typeof value === "string") {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            parsedValue = value;
          }
        }

        let jsonString: string;
        try {
          jsonString = JSON.stringify(parsedValue, null, 2);
          if (!jsonString || jsonString === "null") {
            jsonString = String(parsedValue);
          }
        } catch {
          const seen = new WeakSet();
          try {
            jsonString = JSON.stringify(
              parsedValue,
              (key, val) => {
                if (val != null && typeof val === "object") {
                  if (seen.has(val)) {
                    return "[Circular]";
                  }
                  seen.add(val);
                }
                return val;
              },
              2
            );
          } catch {
            jsonString = String(parsedValue);
          }
        }

        let formatted: string;
        try {
          formatted = prettier.default.format(jsonString, {
            parser: "json",
            plugins: [babel.default],
            printWidth: 60,
          });
        } catch {
          formatted = jsonString;
        }

        if (!cancelled) {
          setFormattedJson(formatted);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          let displayValue: string;
          if (value === null) {
            displayValue = "null";
          } else if (value === undefined) {
            displayValue = "undefined";
          } else if (typeof value === "string") {
            displayValue = value;
          } else {
            try {
              displayValue = JSON.stringify(value, null, 2);
            } catch {
              displayValue = String(value);
            }
          }
          setFormattedJson(displayValue);
          setIsLoading(false);
        }
      }
    }

    formatJSON();

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (value === null || value === undefined) {
    return (
      <div className={containerClass}>
        <pre className="text-xs text-gray-300 font-mono">
          {value === null ? "null" : "undefined"}
        </pre>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={clsx(
          containerClass,
          "flex min-h-[4.5rem] items-center justify-center p-4"
        )}
      >
        <Spinner color="white" />
      </div>
    );
  }

  if (!formattedJson) {
    return null;
  }

  let highlighted: ReactNode;
  try {
    highlighted = formattedJson.split("\n").map((line, lineIdx) => {
      let result = "";
      let i = 0;

      while (i < line.length) {
        const stringMatch = line.slice(i).match(/^"([^"\\]|\\.)*"/);
        if (stringMatch) {
          // eslint-disable-next-line i18next/no-literal-string -- JSON syntax highlight HTML
          result += `<span class="text-green-400">${stringMatch[0]}</span>`;
          i += stringMatch[0].length;
          continue;
        }

        const keywordMatch = line.slice(i).match(/^(true|false|null)\b/);
        if (keywordMatch) {
          // eslint-disable-next-line i18next/no-literal-string -- JSON syntax highlight HTML
          result += `<span class="text-purple-400">${keywordMatch[0]}</span>`;
          i += keywordMatch[0].length;
          continue;
        }

        const numberMatch = line.slice(i).match(/^-?\d+\.?\d*/);
        if (numberMatch) {
          // eslint-disable-next-line i18next/no-literal-string -- JSON syntax highlight HTML
          result += `<span class="text-blue-400">${numberMatch[0]}</span>`;
          i += numberMatch[0].length;
          continue;
        }

        if (/^[{}[\]]/.test(line.slice(i))) {
          // eslint-disable-next-line i18next/no-literal-string -- JSON syntax highlight HTML
          result += `<span class="text-gray-400">${line[i]}</span>`;
          i++;
          continue;
        }

        if (line[i] === ":") {
          // eslint-disable-next-line i18next/no-literal-string -- JSON syntax highlight HTML
          result += '<span class="text-gray-500">:</span>';
          i++;
          continue;
        }

        if (line[i] === ",") {
          // eslint-disable-next-line i18next/no-literal-string -- JSON syntax highlight HTML
          result += '<span class="text-gray-500">,</span>';
          i++;
          continue;
        }

        result += line[i];
        i++;
      }

      return (
        <div key={lineIdx} className="font-mono text-xs text-gray-300">
          <span dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      );
    });
  } catch {
    highlighted = formattedJson.split("\n").map((line, lineIdx) => (
      <div key={lineIdx} className="font-mono text-xs text-gray-300">
        {line}
      </div>
    ));
  }

  return (
    <div className={containerClass}>
      <pre className="text-xs">{highlighted}</pre>
    </div>
  );
}
