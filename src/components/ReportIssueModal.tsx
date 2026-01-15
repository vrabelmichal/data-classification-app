import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportIssueModal({ isOpen, onClose }: ReportIssueModalProps) {
  const [description, setDescription] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitReport = useMutation(api.issueReports.submitReport);

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error("Please describe the issue");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReport({ description, url: currentUrl || undefined });
      toast.success("Issue reported successfully. Thank you!");
      setDescription("");
      onClose();
    } catch (error) {
      console.error("Failed to submit report:", error);
      toast.error("Failed to submit issue report");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 md:mx-6 p-6 md:p-8 max-h-[85vh] min-h-[60vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Report an Issue
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="mb-3 flex items-center gap-3">
              {/* <label htmlFor="issue-url" className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Page URL</label> */}
              <input id="issue-url" type="text" value={currentUrl} readOnly className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200" />
            </div>
          <div className="mb-4 flex flex-col flex-1">
            <label
              htmlFor="issue-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Describe the issue you're experiencing
            </label>
            <textarea
              id="issue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about the issue..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none flex-1 min-h-[220px]"
              rows={6}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Please be as specific as possible to help us resolve the issue faster.
            </p>
          </div>

          <div className="flex gap-3 justify-end mt-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
