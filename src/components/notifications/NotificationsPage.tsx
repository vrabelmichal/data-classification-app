import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Id } from "../../../convex/_generated/dataModel";

// Simple markdown renderer (no HTML allowed for security)
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  const processInlineMarkdown = (line: string): React.ReactNode => {
    // Process inline elements: bold, italic, code, links
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Bold: **text** or __text__
      const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/);
      if (boldMatch) {
        if (boldMatch[1]) parts.push(boldMatch[1]);
        parts.push(<strong key={key++}>{boldMatch[3]}</strong>);
        remaining = boldMatch[4];
        continue;
      }

      // Italic: *text* or _text_ (but not ** or __)
      const italicMatch = remaining.match(/^(.*?)(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)(.*)$/);
      if (italicMatch) {
        if (italicMatch[1]) parts.push(italicMatch[1]);
        parts.push(<em key={key++}>{italicMatch[2]}</em>);
        remaining = italicMatch[3];
        continue;
      }

      // Inline code: `code`
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
      if (codeMatch) {
        if (codeMatch[1]) parts.push(codeMatch[1]);
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono"
          >
            {codeMatch[2]}
          </code>
        );
        remaining = codeMatch[3];
        continue;
      }

      // Link: [text](url)
      const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
      if (linkMatch) {
        if (linkMatch[1]) parts.push(linkMatch[1]);
        parts.push(
          <a
            key={key++}
            href={linkMatch[3]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {linkMatch[2]}
          </a>
        );
        remaining = linkMatch[4];
        continue;
      }

      // No more matches, add remaining text
      parts.push(remaining);
      break;
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto my-2 text-sm font-mono"
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
      elements.push(
        <h3 key={i} className="text-lg font-semibold mt-4 mb-2">
          {processInlineMarkdown(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl font-semibold mt-4 mb-2">
          {processInlineMarkdown(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold mt-4 mb-2">
          {processInlineMarkdown(line.slice(2))}
        </h1>
      );
    }
    // Bullet lists
    else if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          {processInlineMarkdown(line.slice(2))}
        </li>
      );
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={i} className="ml-4 list-decimal">
          {processInlineMarkdown(content)}
        </li>
      );
    }
    // Blockquote
    else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2"
        >
          {processInlineMarkdown(line.slice(2))}
        </blockquote>
      );
    }
    // Horizontal rule
    else if (line.match(/^[-*_]{3,}$/)) {
      elements.push(
        <hr key={i} className="my-4 border-gray-300 dark:border-gray-600" />
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<br key={i} />);
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={i} className="my-1">
          {processInlineMarkdown(line)}
        </p>
      );
    }
  }

  return elements;
}

export function NotificationsPage() {
  usePageTitle("Notifications");

  const notifications = useQuery(api.notifications.getUserNotifications);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAsUnread = useMutation(api.notifications.markAsUnread);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

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

  if (notifications === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {notifications.length === 0
              ? "No notifications"
              : unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
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
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                      {renderMarkdown(notification.content)}
                    </div>
                  </div>
                    <div className="flex items-center gap-2">
                      {!notification.isRead ? (
                        <button
                          onClick={() => handleMarkAsRead(notification._id)}
                          className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        >
                          Mark as read
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkAsUnread(notification._id)}
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
      )}
    </div>
  );
}
