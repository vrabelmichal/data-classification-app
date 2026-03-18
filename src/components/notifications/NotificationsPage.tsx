import { useQuery, useMutation } from "convex/react";
import { lazy, Suspense, useState } from "react";
import { NavLink, Navigate, useLocation } from "react-router";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Id } from "../../../convex/_generated/dataModel";
import { cn } from "../../lib/utils";

const NOTIFICATIONS_INBOX_PATH = "/notifications";
const NOTIFICATIONS_CREATE_PATH = "/notifications/create";
const MAX_INLINE_MARKDOWN_DEPTH = 24;

type ParagraphLine = {
  text: string;
  hardBreakAfter: boolean;
};

const LazyAdminNotificationsPanel = lazy(() =>
  import("./AdminNotificationsPanel").then((module) => ({
    default: module.AdminNotificationsPanel,
  }))
);

// Simple markdown renderer (no HTML allowed for security)
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let paragraphLines: ParagraphLine[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];

  type InlineMarkdownToken =
    | {
        type: "link";
        index: number;
        fullMatch: string;
        text: string;
        url: string;
      }
    | {
        type: "code" | "boldItalic" | "bold" | "italic";
        index: number;
        fullMatch: string;
        content: string;
      };

  const findNextInlineMarkdownToken = (
    value: string
  ): InlineMarkdownToken | null => {
    const linkMatch = value.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const codeMatch = value.match(/`([^`]+)`/);
    const boldItalicMatch = value.match(/(\*\*\*|___)(.+?)\1/);
    const boldMatch = value.match(/(\*\*|__)(.+?)\1/);
    const italicAsteriskMatch = value.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    const italicUnderscoreMatch = value.match(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/);

    const candidates: InlineMarkdownToken[] = [];

    if (linkMatch && linkMatch.index !== undefined) {
      candidates.push({
        type: "link",
        index: linkMatch.index,
        fullMatch: linkMatch[0],
        text: linkMatch[1],
        url: linkMatch[2],
      });
    }

    if (codeMatch && codeMatch.index !== undefined) {
      candidates.push({
        type: "code",
        index: codeMatch.index,
        fullMatch: codeMatch[0],
        content: codeMatch[1],
      });
    }

    if (boldItalicMatch && boldItalicMatch.index !== undefined) {
      candidates.push({
        type: "boldItalic",
        index: boldItalicMatch.index,
        fullMatch: boldItalicMatch[0],
        content: boldItalicMatch[2],
      });
    }

    if (boldMatch && boldMatch.index !== undefined) {
      candidates.push({
        type: "bold",
        index: boldMatch.index,
        fullMatch: boldMatch[0],
        content: boldMatch[2],
      });
    }

    if (italicAsteriskMatch && italicAsteriskMatch.index !== undefined) {
      candidates.push({
        type: "italic",
        index: italicAsteriskMatch.index,
        fullMatch: italicAsteriskMatch[0],
        content: italicAsteriskMatch[1],
      });
    }

    if (italicUnderscoreMatch && italicUnderscoreMatch.index !== undefined) {
      candidates.push({
        type: "italic",
        index: italicUnderscoreMatch.index,
        fullMatch: italicUnderscoreMatch[0],
        content: italicUnderscoreMatch[1],
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((earliest, candidate) =>
      candidate.index < earliest.index ? candidate : earliest
    );
  };

  const processInlineMarkdown = (
    line: string,
    depth = 0
  ): React.ReactNode => {
    if (depth >= MAX_INLINE_MARKDOWN_DEPTH) {
      return line;
    }

    // Process inline elements by earliest token so formats don't mask each other.
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const nextToken = findNextInlineMarkdownToken(remaining);
      if (!nextToken) {
        parts.push(remaining);
        break;
      }

      if (nextToken.index > 0) {
        parts.push(remaining.slice(0, nextToken.index));
      }

      if (nextToken.type === "link") {
        const isSafeUrl = /^(https?:|mailto:)/i.test(nextToken.url.trimStart());
        if (isSafeUrl) {
          parts.push(
            <a
              key={key++}
              href={nextToken.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {processInlineMarkdown(nextToken.text, depth + 1)}
            </a>
          );
        } else {
          parts.push(
            <span key={key++}>{processInlineMarkdown(nextToken.text, depth + 1)}</span>
          );
        }
      } else if (nextToken.type === "code") {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono"
          >
            {nextToken.content}
          </code>
        );
      } else if (nextToken.type === "boldItalic") {
        parts.push(
          <strong key={key++}>
            <em>{processInlineMarkdown(nextToken.content, depth + 1)}</em>
          </strong>
        );
      } else if (nextToken.type === "bold") {
        parts.push(<strong key={key++}>{processInlineMarkdown(nextToken.content, depth + 1)}</strong>);
      } else if (nextToken.type === "italic") {
        parts.push(<em key={key++}>{processInlineMarkdown(nextToken.content, depth + 1)}</em>);
      }

      remaining = remaining.slice(nextToken.index + nextToken.fullMatch.length);
      continue;

    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const parseParagraphLine = (line: string): ParagraphLine => {
    let normalized = line;
    let hardBreakAfter = false;

    if (/ {2,}$/.test(normalized)) {
      hardBreakAfter = true;
      normalized = normalized.replace(/ {2,}$/, "");
    } else if (/(^|[^\\])(\\\\)*\\$/.test(normalized)) {
      hardBreakAfter = true;
      normalized = normalized.slice(0, -1);
    }

    return {
      text: normalized.trim(),
      hardBreakAfter,
    };
  };

  const renderParagraphContent = (linesToRender: ParagraphLine[]) => {
    const parts: React.ReactNode[] = [];

    for (let index = 0; index < linesToRender.length; index += 1) {
      const line = linesToRender[index];
      parts.push(
        <span key={`text-${index}`}>{processInlineMarkdown(line.text)}</span>
      );

      if (index < linesToRender.length - 1) {
        parts.push(
          line.hardBreakAfter ? <br key={`break-${index}`} /> : " "
        );
      }
    }

    return parts;
  };

  const flushParagraph = (key: string) => {
    if (paragraphLines.length === 0) {
      return;
    }

    elements.push(
      <p key={key} className="my-4 leading-7 text-gray-700 dark:text-gray-300">
        {renderParagraphContent(paragraphLines)}
      </p>
    );
    paragraphLines = [];
  };

  const flushList = (key: string) => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }

    if (listType === "ul") {
      elements.push(
        <ul
          key={key}
          className="my-5 list-disc space-y-2 pl-6 marker:text-gray-400 dark:marker:text-gray-500"
        >
          {listItems}
        </ul>
      );
    } else {
      elements.push(
        <ol
          key={key}
          className="my-5 list-decimal space-y-2 pl-6 marker:text-gray-400 dark:marker:text-gray-500"
        >
          {listItems}
        </ol>
      );
    }

    listType = null;
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (line.startsWith("```")) {
      flushParagraph(`paragraph-before-code-${i}`);
      flushList(`list-before-code-${i}`);
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-6 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200"
          >
            {codeBlockContent.join("\n")}
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      flushParagraph(`paragraph-before-h3-${i}`);
      flushList(`list-before-h3-${i}`);
      elements.push(
        <h3 key={i} className="mt-8 mb-3 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
          {processInlineMarkdown(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      flushParagraph(`paragraph-before-h2-${i}`);
      flushList(`list-before-h2-${i}`);
      elements.push(
        <h2 key={i} className="mt-10 mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {processInlineMarkdown(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      flushParagraph(`paragraph-before-h1-${i}`);
      flushList(`list-before-h1-${i}`);
      elements.push(
        <h1 key={i} className="mt-10 mb-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {processInlineMarkdown(line.slice(2))}
        </h1>
      );
    }
    // Bullet lists
    else if (line.match(/^[-*]\s/)) {
      flushParagraph(`paragraph-before-ul-${i}`);
      if (listType === "ol") {
        flushList(`list-before-ul-${i}`);
      }
      listType = "ul";
      listItems.push(
        <li key={i} className="pl-1 leading-7 text-gray-700 dark:text-gray-300">
          {processInlineMarkdown(line.slice(2))}
        </li>
      );
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      flushParagraph(`paragraph-before-ol-${i}`);
      if (listType === "ul") {
        flushList(`list-before-ol-${i}`);
      }
      listType = "ol";
      const content = line.replace(/^\d+\.\s/, "");
      listItems.push(
        <li key={i} className="pl-1 leading-7 text-gray-700 dark:text-gray-300">
          {processInlineMarkdown(content)}
        </li>
      );
    }
    // Blockquote
    else if (line.startsWith("> ")) {
      flushParagraph(`paragraph-before-blockquote-${i}`);
      flushList(`list-before-blockquote-${i}`);
      elements.push(
        <blockquote
          key={i}
          className="my-6 border-l-4 border-slate-300 pl-5 pr-1 italic leading-7 text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          {processInlineMarkdown(line.slice(2))}
        </blockquote>
      );
    }
    // Horizontal rule
    else if (line.match(/^[-*_]{3,}$/)) {
      flushParagraph(`paragraph-before-hr-${i}`);
      flushList(`list-before-hr-${i}`);
      elements.push(
        <hr key={i} className="my-8 border-gray-200 dark:border-gray-700" />
      );
    }
    // Empty line
    else if (trimmed === "") {
      flushParagraph(`paragraph-break-${i}`);
      flushList(`list-break-${i}`);
    }
    // Regular paragraph
    else {
      flushList(`list-before-paragraph-${i}`);
      paragraphLines.push(parseParagraphLine(line));
    }
  }

  flushParagraph("paragraph-final");
  flushList("list-final");

  return elements;
}

function getContentPreview(content: string, maxChars = 220): string {
  const plain = content
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*+]\s/, "")
        .replace(/^\d+\.\s/, "")
        .replace(/^>\s/, "")
        .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
        .replace(/___(.+?)___/g, "$1")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim()
    )
    .filter((line) => line.length > 0)
    .join(" ");
  return plain.length > maxChars ? plain.slice(0, maxChars).trimEnd() + "\u2026" : plain;
}

type ViewMode = "header" | "preview" | "full";

export function NotificationsPage() {
  const location = useLocation();
  const normalizedPath =
    location.pathname !== "/"
      ? location.pathname.replace(/\/+$/, "")
      : location.pathname;
  const isCreateRoute = normalizedPath === NOTIFICATIONS_CREATE_PATH;
  const isInboxRoute = normalizedPath === NOTIFICATIONS_INBOX_PATH;
  const isKnownRoute = isCreateRoute || isInboxRoute;

  usePageTitle(isCreateRoute ? "Create Notifications" : "Notifications");

  const notifications = useQuery(api.notifications.getUserNotifications);
  const userProfile = useQuery(api.users.getUserProfile);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAsUnread = useMutation(api.notifications.markAsUnread);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const isAdmin = userProfile?.role === "admin";

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("notifications_view_mode");
    return saved === "header" || saved === "preview" || saved === "full" ? saved : "preview";
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("notifications_view_mode", mode);
    setExpandedIds(new Set());
  };

  const toggleCardExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAsUnread = async (notificationId: Id<"notifications">) => {
    try {
      await markAsUnread({ notificationId });
    } catch (error) {
      console.error("Failed to mark notification as unread:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead({});
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  if (!isKnownRoute) {
    return <Navigate to={NOTIFICATIONS_INBOX_PATH} replace />;
  }

  if (notifications === undefined || (isCreateRoute && userProfile === undefined)) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isCreateRoute && !isAdmin) {
    return <Navigate to={NOTIFICATIONS_INBOX_PATH} replace />;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const description =
    isCreateRoute
      ? "Create notifications, choose recipients, and review sent messages."
      : notifications.length === 0
        ? "No notifications"
        : unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
          : "All caught up!";

  const renderInbox = () => {
    if (notifications.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No notifications yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You'll see notifications from the team here when they're sent.
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* View mode selector */}
        <div className="mb-4 flex items-center">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-1 dark:bg-gray-800/70"
            role="group"
            aria-label="Message view mode"
          >
            {(
              [
                {
                  mode: "header" as const,
                  label: "Header",
                  title: "Show header only",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                      <rect x="1" y="2" width="13" height="3" rx="1" fill="currentColor" />
                      <rect x="1" y="7.5" width="13" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
                      <rect x="1" y="11" width="9" height="1.5" rx="0.5" fill="currentColor" opacity="0.25" />
                    </svg>
                  ),
                },
                {
                  mode: "preview" as const,
                  label: "Preview",
                  title: "Show short preview",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                      <rect x="1" y="2" width="13" height="2.5" rx="1" fill="currentColor" />
                      <rect x="1" y="7" width="13" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
                      <rect x="1" y="10.5" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
                      <circle cx="10.5" cy="13.5" r="0.8" fill="currentColor" opacity="0.5" />
                      <circle cx="13" cy="13.5" r="0.8" fill="currentColor" opacity="0.3" />
                    </svg>
                  ),
                },
                {
                  mode: "full" as const,
                  label: "Full",
                  title: "Show full messages",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                      <rect x="1" y="1.5" width="13" height="2" rx="0.5" fill="currentColor" />
                      <rect x="1" y="5.5" width="13" height="2" rx="0.5" fill="currentColor" />
                      <rect x="1" y="9.5" width="13" height="2" rx="0.5" fill="currentColor" />
                      <rect x="1" y="13" width="9" height="1.5" rx="0.5" fill="currentColor" />
                    </svg>
                  ),
                },
              ] as const
            ).map(({ mode, label, title, icon }) => (
              <button
                key={mode}
                onClick={() => handleSetViewMode(mode)}
                title={title}
                aria-pressed={viewMode === mode}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  viewMode === mode
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                )}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notification cards */}
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isIndividuallyExpanded = expandedIds.has(notification._id);
            const effectiveMode: ViewMode = isIndividuallyExpanded ? "full" : viewMode;
            const showToggleButton = viewMode !== "full";

            return (
              <div
                key={notification._id}
                className={cn(
                  "rounded-lg border bg-white shadow-sm transition-all dark:bg-gray-800",
                  notification.isRead
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-blue-300 ring-2 ring-blue-100 dark:border-blue-600 dark:ring-blue-900/30"
                )}
              >
                <div className="px-4 py-3 sm:px-5 sm:py-4">
                  {/* Header row: title + action buttons */}
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {!notification.isRead && (
                        <span className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          New
                        </span>
                      )}
                      <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                        {notification.title}
                      </h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {/* Read / unread toggle */}
                      {!notification.isRead ? (
                        <button
                          onClick={() => handleMarkAsRead(notification._id)}
                          title="Mark as read"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect width="20" height="16" x="2" y="4" rx="2" />
                            <path d="m22 7-10 7L2 7" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkAsUnread(notification._id)}
                          title="Mark as unread"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M22 10V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10" />
                            <path d="M22 10L12 2L2 10" />
                            <path d="M2 10l10 7 10-7" />
                          </svg>
                        </button>
                      )}
                      {/* Expand / collapse per-card toggle */}
                      {showToggleButton && (
                        <button
                          onClick={() => toggleCardExpanded(notification._id)}
                          title={isIndividuallyExpanded ? "Collapse" : "Expand"}
                          aria-expanded={isIndividuallyExpanded}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        >
                          {isIndividuallyExpanded ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Meta: sender + timestamp */}
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    From {notification.creatorName} •{" "}
                    {new Date(notification.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {/* Content area — driven by effective view mode */}
                  {effectiveMode === "preview" && (
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {getContentPreview(notification.content)}
                    </p>
                  )}
                  {effectiveMode === "full" && (
                    <div className="mt-3 max-w-none text-[15px] leading-7 sm:text-base [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                      {renderMarkdown(notification.content)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {description}
          </p>
        </div>
        {!isCreateRoute && unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Notification sections">
            {[
              { id: "inbox", label: "Inbox", icon: "🔔", path: NOTIFICATIONS_INBOX_PATH, end: true },
              { id: "manage", label: "Create Notifications", icon: "✉️", path: NOTIFICATIONS_CREATE_PATH },
            ].map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap",
                    isActive
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )
                }
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {isCreateRoute ? (
        <Suspense
          fallback={
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          }
        >
          <LazyAdminNotificationsPanel defaultIsCreating />
        </Suspense>
      ) : (
        renderInbox()
      )}
    </div>
  );
}
