import { useEffect } from "react";

export interface ImageUrlGroup {
  label: string;
  entries: Array<{
    key: string;
    label: string;
    url: string;
  }>;
}

interface ImageUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  galaxyId: string;
  groups: ImageUrlGroup[];
  maskSummary: string;
}

export function ImageUrlsModal({
  isOpen,
  onClose,
  galaxyId,
  groups,
  maskSummary,
}: ImageUrlsModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-8 sm:p-4 sm:pt-12 lg:items-center lg:pt-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-urls-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Image URLs</h2>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              {galaxyId} • {maskSummary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close image URLs modal"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.map((group, groupIndex) => (
            <section key={`${group.label}-${groupIndex}`} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {group.label || `Contrast Group ${groupIndex + 1}`}
              </h3>
              <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                <table className="min-w-full table-fixed border-collapse text-[10px] sm:text-[11px]">
                  <colgroup>
                    <col className="w-[35%] lg:w-[25%]" />
                    <col className="w-[65%] lg:w-[75%]" />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">
                        Label
                      </th>
                      <th className="px-2.5 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">
                        URL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry, entryIndex) => (
                      <tr key={`${groupIndex}-${entry.key}-${entryIndex}`} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-2.5 py-1.5 align-top text-gray-700 dark:text-gray-200 whitespace-normal [overflow-wrap:anywhere]">
                          {entry.label}
                        </td>
                        <td className="px-2.5 py-1.5 align-top">
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-mono text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {entry.url}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}