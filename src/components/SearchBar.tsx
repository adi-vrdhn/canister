"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getBlurDataUrl } from "@/lib/performance";

interface SearchData {
  id: string | number;
  title: string;
  subtitle?: string;
  image?: string;
  year?: string;
  type?: string;
  originalId?: number;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => Promise<SearchData[]>;
  onSelect: (item: SearchData) => void;
  debounceMs?: number;
  disabled?: boolean;
  minChars?: number;
  theme?: "default" | "brutalist";
}

export default function SearchBar({
  placeholder = "Search...",
  onSearch,
  onSelect,
  debounceMs = 300,
  disabled = false,
  minChars = 1,
  theme = "default",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isBrutalist = theme === "brutalist";

  const rankResults = (items: SearchData[], rawQuery: string) => {
    const normalizedQuery = rawQuery.trim().toLowerCase();
    if (!normalizedQuery) return items;

    return [...items].sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aStarts = aTitle.startsWith(normalizedQuery) ? 1 : 0;
      const bStarts = bTitle.startsWith(normalizedQuery) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      const aIncludes = aTitle.includes(normalizedQuery) ? 1 : 0;
      const bIncludes = bTitle.includes(normalizedQuery) ? 1 : 0;
      if (aIncludes !== bIncludes) return bIncludes - aIncludes;

      return aTitle.localeCompare(bTitle);
    });
  };

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < minChars) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    debounceTimer.current = setTimeout(async () => {
      try {
        const data = await onSearch(query);
        if (requestId !== requestIdRef.current) return;
        setResults(rankResults(data, query));
        setIsOpen(true);
      } catch (error) {
        // Silently ignore search errors
        if (requestId === requestIdRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, onSearch, debounceMs, minChars]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: SearchData) => {
    onSelect(item);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="field pr-20 text-base"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
            className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-medium transition ${
              isBrutalist
                ? "border border-white/10 bg-[#111111] text-[#f5f0de] hover:bg-white/5"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Clear
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (results.length > 0 || (isLoading && results.length === 0)) && (
        <div className="menu-panel absolute left-0 right-0 top-full z-50 mt-3 max-w-2xl overflow-hidden">
          {results.length > 0 ? (
            <ul className="max-h-[min(70dvh,600px)] overflow-y-auto overscroll-contain">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 sm:gap-4 sm:px-4 sm:py-4 ${
                      isBrutalist
                        ? "border-white/10 hover:bg-white/5"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm sm:h-24 sm:w-16 sm:rounded-2xl">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={64}
                          height={96}
                          className="h-full w-full object-cover"
                          placeholder="blur"
                          blurDataURL={getBlurDataUrl()}
                        />
                      ) : (
                        <span className="px-1 text-center text-[10px] font-medium leading-tight text-white/40">
                          No poster
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-base font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className={`mt-1 text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>{item.subtitle}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="p-8 text-center">
              <p className={`font-medium ${isBrutalist ? "text-[#f5f0de]" : "text-slate-700"}`}>No results found</p>
              <p className={`mt-2 text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>Try a different search term</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
