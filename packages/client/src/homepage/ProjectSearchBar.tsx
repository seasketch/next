/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import { createPortal } from "react-dom";

const PROJECT_SEARCH = gql`
  query ProjectSearch($query: String!) {
    searchProjects(query: $query) {
      id
      name
      description
      logoUrl
      slug
    }
  }
`;

export default function ProjectSearchBar() {
  const history = useHistory();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef<HTMLAnchorElement[]>([]);
  const listboxId = useMemo(
    () => `project-search-listbox-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(handle);
  }, [query]);

  const { data, loading } = useQuery(PROJECT_SEARCH, {
    skip: debouncedQuery.length < 2,
    variables: { query: debouncedQuery },
    fetchPolicy: "cache-and-network",
    returnPartialData: true,
  });

  type SearchResult = {
    id: string;
    name: string;
    description?: string | null;
    slug: string;
    logoUrl?: string | null;
  };
  const results = useMemo<SearchResult[]>(
    () => (data?.searchProjects ?? []) as SearchResult[],
    [data?.searchProjects]
  );

  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [debouncedQuery, results.length, loading]);

  useEffect(() => {
    setActiveIndex(-1);
    itemRefs.current = [];
  }, [results.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        (!dropdownRef.current ||
          !dropdownRef.current.contains(e.target as Node))
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Power user shortcut: focus input when pressing '/'
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const isEditable =
          (target as any)?.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT";
        if (isEditable) return;
        if (inputRef.current && document.activeElement !== inputRef.current) {
          e.preventDefault();
          try {
            (inputRef.current as any).focus({ preventScroll: true });
          } catch (_) {
            inputRef.current!.focus();
          }
        }
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => {
    function updateRect() {
      const el = inputContainerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownRect({
        top: r.bottom + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
      });
    }
    if (isOpen) {
      updateRect();
    }
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setValidationMessage("Please enter at least 3 characters to search.");
      return;
    }
    setValidationMessage(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      !isOpen &&
      (e.key === "ArrowDown" || e.key === "ArrowUp") &&
      results.length > 0
    ) {
      setIsOpen(true);
    }
    // Cmd+Enter: navigate to first result
    if (e.key === "Enter" && e.metaKey) {
      if (results.length > 0) {
        e.preventDefault();
        const p = results[0];
        history.push(`/${p.slug}/app`);
        setIsOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % results.length;
        const el = itemRefs.current[next];
        if (el) el.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((prev) => {
        const next = prev <= 0 ? results.length - 1 : prev - 1;
        const el = itemRefs.current[next];
        if (el) el.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        const p = results[activeIndex];
        history.push(`/${p.slug}/app`);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
  }

  return (
    <div className="mt-8 flex items-center justify-center">
      <div className="w-full max-w-xl" ref={containerRef}>
        <form onSubmit={onSubmit} className="w-full">
          <div
            className="flex w-full items-center rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5 backdrop-blur relative"
            ref={inputContainerRef}
          >
            <input
              name="q"
              placeholder="Search for a project…"
              className="ml-2 flex-1 bg-transparent outline-none placeholder:text-slate-400 text-slate-100 focus:ring-0 border-none"
              ref={inputRef}
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (validationMessage && v.trim().length >= 3) {
                  setValidationMessage(null);
                }
              }}
              onFocus={() => {
                if (debouncedQuery.length >= 3) setIsOpen(true);
              }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0
                  ? `${listboxId}-option-${activeIndex}`
                  : undefined
              }
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-medium ring-1 ring-inset ring-white/20 text-white hover:bg-white/10"
            >
              Search
            </button>
            {isOpen &&
              dropdownRect &&
              createPortal(
                <div
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    top: dropdownRect.top + 8,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                    zIndex: 50,
                  }}
                  className="rounded-xl border border-white/10 bg-slate-900 text-slate-100 shadow-lg overflow-hidden"
                >
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="max-h-80 overflow-auto divide-y divide-white/5"
                  >
                    {loading && results.length === 0 && (
                      <li className="px-4 py-3 text-sm text-slate-300">
                        Searching…
                      </li>
                    )}
                    {results.map((p, idx) => (
                      <li
                        key={p.id}
                        role="option"
                        aria-selected={idx === activeIndex}
                        id={`${listboxId}-option-${idx}`}
                      >
                        <Link
                          to={`/${p.slug}/app`}
                          ref={(el) => {
                            if (el)
                              itemRefs.current[idx] = el as HTMLAnchorElement;
                          }}
                          className={`flex items-center text-left px-4 py-3 space-x-2 ${
                            idx === activeIndex
                              ? "bg-blue-600 text-white"
                              : "hover:bg-white/10"
                          }`}
                          onClick={() => setIsOpen(false)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          {p.logoUrl && (
                            <img
                              src={p.logoUrl}
                              alt=""
                              className="h-6 w-6 flex-none object-contain"
                            />
                          )}
                          <div className="font-medium text-left flex-none">
                            {p.name}
                          </div>
                          <span className="opacity-70 flex-1 truncate">
                            {p.description}
                          </span>
                          {activeIndex === -1 && idx === 0 && (
                            <span className="text-slate-700 flex-none truncate place-self-end outline px-1 outline-slate-700/50 rounded-sm shadow-md">
                              ⌘-Enter
                            </span>
                          )}
                          {activeIndex === idx && (
                            <span className="text-slate-700 flex-none truncate place-self-end outline px-1 outline-slate-700/50 rounded-sm shadow-md">
                              Enter
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                    {!loading &&
                      debouncedQuery.length >= 2 &&
                      results.length === 0 && (
                        <li className="px-4 py-3 text-sm text-slate-300">
                          No results
                        </li>
                      )}
                  </ul>
                </div>,
                document.body
              )}
          </div>
          {validationMessage && (
            <div className="mt-2 text-xs text-cyan-300" role="alert">
              {validationMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
