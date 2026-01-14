import { useCallback, useEffect, useState } from "react";
import useDebounce from "../../useDebounce";
import Spinner from "../../components/Spinner";
import { Trans, useTranslation } from "react-i18next";
import { XIcon } from "@heroicons/react/outline";
import sanitizeHtml from "sanitize-html";

interface ProjectResult {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  headerImageUrl?: string;
  slug?: string;
}

interface INaturalistProjectAutocompleteProps {
  value: ProjectResult | null;
  onChange: (project: ProjectResult | null) => void;
  disabled?: boolean;
}

export default function INaturalistProjectAutocomplete({
  value,
  onChange,
  disabled = false,
}: INaturalistProjectAutocompleteProps) {
  const { t } = useTranslation("admin:data");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchProjects = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line i18next/no-literal-string
      const response = await fetch(
        `https://api.inaturalist.org/v1/projects/autocomplete?q=${encodeURIComponent(
          query
        )}&per_page=50`
      );
      const data = await response.json();
      const projects: ProjectResult[] = (data.results || []).map(
        (item: any) => ({
          id: item.id,
          title: item.title || item.name || "",
          description: item.description,
          icon: item.icon_url,
          headerImageUrl: item.header_image_url,
          slug: item.slug,
        })
      );
      setResults(projects);
    } catch (error) {
      console.error("Error searching iNaturalist projects:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery) {
      searchProjects(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, searchProjects]);

  const handleSelect = (project: ProjectResult) => {
    onChange(project);
    setSearchQuery(project.title);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery("");
    setIsOpen(false);
  };

  const sanitizeDescription = (html: string): string => {
    // Sanitize HTML to allow safe tags but remove potentially dangerous ones
    return sanitizeHtml(html, {
      allowedTags: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "a",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ],
      allowedAttributes: {
        a: ["href", "target", "rel"],
      },
    });
  };

  const truncateHtml = (html: string, maxLength: number = 150): string => {
    // Strip HTML tags temporarily to check length
    const textContent = html.replace(/<[^>]*>/g, "");
    if (textContent.length <= maxLength) {
      return html;
    }

    // Truncate and try to close any open tags
    let truncated = textContent.substring(0, maxLength);
    // Find the last space to avoid cutting words
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.7) {
      truncated = truncated.substring(0, lastSpace);
    }
    truncated += "...";

    // Re-apply basic formatting if needed, but keep it simple
    // eslint-disable-next-line i18next/no-literal-string
    return `<p>${truncated}</p>`;
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
        <Trans ns="admin:data">Project</Trans>
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={t("Search for an iNaturalist project...")}
          disabled={disabled}
          className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={t("Clear selection")}
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner mini />
          </div>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => handleSelect(project)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-start space-x-3"
            >
              {(project.headerImageUrl || project.icon) && (
                <img
                  src={project.headerImageUrl || project.icon}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{project.title}</div>
                {project.description && (
                  <div
                    className="text-sm text-gray-500 line-clamp-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: truncateHtml(
                        sanitizeDescription(project.description),
                        150
                      ),
                    }}
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded flex items-start space-x-2">
          {(value.headerImageUrl || value.icon) && (
            <img
              src={value.headerImageUrl || value.icon}
              alt=""
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {value.title}
            </div>
            {value.description && (
              <div
                className="text-xs text-gray-600 mt-1 prose prose-xs max-w-none line-clamp-3"
                dangerouslySetInnerHTML={{
                  __html: sanitizeDescription(value.description),
                }}
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label={t("Clear selection")}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
