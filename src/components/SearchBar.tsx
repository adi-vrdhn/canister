"use client";

import { useState, useEffect, useRef } from "react";

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
}

export default function SearchBar({
  placeholder = "Search...",
  onSearch,
  onSelect,
  debounceMs = 300,
  disabled = false,
  minChars = 2,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < minChars) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const data = await onSearch(query);
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        // Silently ignore search errors
        setResults([]);
      } finally {
        setIsLoading(false);
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
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
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
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors hover:bg-slate-50 last:border-b-0 sm:gap-4 sm:px-4 sm:py-4"
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-20 w-14 flex-shrink-0 rounded-xl object-cover shadow-sm sm:h-24 sm:w-16 sm:rounded-2xl"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="p-8 text-center">
              <p className="font-medium text-slate-700">No results found</p>
              <p className="mt-2 text-sm text-slate-500">Try a different search term</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
