import { useQuery, useMutation } from "convex/react";
import { lazy, Suspense } from "react";
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

  const renderInbox = () => (
    notifications.length === 0 ? (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📭</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No notifications yet
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          You'll see notifications from the team here when they're sent.
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        {notifications.map((notification) => (
          <div
            key={notification._id}
            role={!notification.isRead ? "button" : undefined}
            aria-label={!notification.isRead ? `Mark as read: ${notification.title}` : undefined}
            tabIndex={!notification.isRead ? 0 : undefined}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border transition-all ${
              notification.isRead
                ? "border-gray-200 dark:border-gray-700"
                : "border-blue-300 dark:border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/30"
            }`}
            onClick={() => {
              if (!notification.isRead) {
                handleMarkAsRead(notification._id);
              }
            }}
            onKeyDown={(e) => {
              if (notification.isRead) {
                return;
              }

              if (e.key === " ") {
                e.preventDefault();
                handleMarkAsRead(notification._id);
              } else if (e.key === "Enter") {
                handleMarkAsRead(notification._id);
              }
            }}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!notification.isRead && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        New
                      </span>
                    )}
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {notification.title}
                    </h2>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    From {notification.creatorName} •{" "}
                    {new Date(notification.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="max-w-none text-[15px] leading-7 sm:text-base [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                    {renderMarkdown(notification.content)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!notification.isRead ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification._id);
                      }}
                      className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                    >
                      Mark as read
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsUnread(notification._id);
                      }}
                      className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Mark as unread
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  );

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
