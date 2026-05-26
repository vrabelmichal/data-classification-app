import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { buildUserSearchText, getUserDisplayLines } from "../../lib/userDisplay";
import { EmailVisibilityToggle } from "./EmailVisibilityToggle";

export type SearchableUserOption = {
  id: string;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  description?: string | null;
  keywords?: string[];
};

function filterOptions(options: SearchableUserOption[], query: string) {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return options;
  }

  return options.filter((option) =>
    buildUserSearchText(option, [option.description, ...(option.keywords ?? [])]).includes(trimmedQuery),
  );
}

function useDismissablePopover(
  isOpen: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [containerRef, isOpen, onClose]);
}

function UserOptionLabel({
  option,
  showEmails,
}: {
  option: SearchableUserOption;
  showEmails: boolean;
}) {
  const display = getUserDisplayLines(option, {
    showEmails,
    fallbackLabel: "Anonymous",
  });

  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
        {display.primary}
      </div>
      {display.secondary ? (
        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
          {display.secondary}
        </div>
      ) : null}
      {option.description ? (
        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
          {option.description}
        </div>
      ) : null}
    </div>
  );
}

type SearchableUserSelectProps = {
  options: SearchableUserOption[];
  value: string | null | undefined;
  onChange: (nextValue: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
  dropdownClassName?: string;
};

export function SearchableUserSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyMessage = "No matching users found.",
  searchPlaceholder = "Search users",
  className,
  dropdownClassName,
}: SearchableUserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEmails, setShowEmails] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useDismissablePopover(isOpen, () => setIsOpen(false), containerRef);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );
  const filteredOptions = useMemo(() => filterOptions(options, query), [options, query]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-gray-400 dark:hover:border-gray-500",
        )}
      >
        <div className="min-w-0 flex-1">
          {selectedOption ? (
            <UserOptionLabel option={selectedOption} showEmails={showEmails} />
          ) : (
            <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
              {placeholder}
            </span>
          )}
        </div>
        <svg className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400", isOpen && "rotate-180")} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen ? (
        <div className={cn("absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800", dropdownClassName)}>
          <div className="mb-3 flex items-center gap-2">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <EmailVisibilityToggle
              showEmails={showEmails}
              onToggle={() => setShowEmails((current) => !current)}
              variant="icon"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                {emptyMessage}
              </div>
            ) : (
              <div role="listbox" className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition",
                      option.id === value
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/60",
                    )}
                  >
                    <UserOptionLabel option={option} showEmails={showEmails} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear selection
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type SearchableUserChecklistProps = {
  options: SearchableUserOption[];
  selectedIds: Set<string>;
  onSelectedIdsChange: (nextValue: Set<string>) => void;
  disabled?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
  listClassName?: string;
};

export function SearchableUserChecklist({
  options,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
  emptyMessage = "No matching users found.",
  searchPlaceholder = "Search users",
  className,
  listClassName,
}: SearchableUserChecklistProps) {
  const [showEmails, setShowEmails] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => filterOptions(options, query), [options, query]);
  const filteredIds = useMemo(() => filteredOptions.map((option) => option.id), [filteredOptions]);

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedIdsChange(next);
  };

  const handleSelectVisible = () => {
    const next = new Set(selectedIds);
    for (const id of filteredIds) {
      next.add(id);
    }
    onSelectedIdsChange(next);
  };

  const handleClearVisible = () => {
    const next = new Set(selectedIds);
    for (const id of filteredIds) {
      next.delete(id);
    }
    onSelectedIdsChange(next);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <EmailVisibilityToggle
          showEmails={showEmails}
          onToggle={() => setShowEmails((current) => !current)}
          variant="icon"
          className="shrink-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <button
          type="button"
          onClick={handleSelectVisible}
          disabled={disabled || filteredIds.length === 0}
          className="rounded-md bg-gray-200 px-2 py-1 text-gray-700 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Select visible
        </button>
        <button
          type="button"
          onClick={handleClearVisible}
          disabled={disabled || filteredIds.every((id) => !selectedIds.has(id))}
          className="rounded-md bg-gray-200 px-2 py-1 text-gray-700 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Deselect visible
        </button>
        <span className="ml-auto">
          {selectedIds.size} selected
        </span>
      </div>

      <div className={cn("max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900", listClassName)}>
        {filteredOptions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {filteredOptions.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm text-gray-900 transition dark:text-gray-100",
                  disabled
                    ? "cursor-not-allowed opacity-60"
                    : "hover:bg-white dark:hover:bg-gray-800",
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(option.id)}
                  onChange={() => handleToggle(option.id)}
                  disabled={disabled}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <UserOptionLabel option={option} showEmails={showEmails} />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
