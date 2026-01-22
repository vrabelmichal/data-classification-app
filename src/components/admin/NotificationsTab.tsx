import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

export function NotificationsTab() {
  const notifications = useQuery(api.notifications.getAllNotifications);
  const users = useQuery(api.notifications.getUsersForSelection);
  const createNotification = useAction(api.notifications.createNotification);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<"notifications"> | null>(null);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSendEmail(false);
    setSendToAll(true);
    setSelectedUsers([]);
    setIsCreating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in both title and content");
      return;
    }

    if (!sendToAll && selectedUsers.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createNotification({
        title: title.trim(),
        content: content.trim(),
        sendEmail,
        recipientUserIds: sendToAll ? undefined : selectedUsers,
      });
      if (result?.emailError) {
        toast.warning(`Notification saved, but email failed: ${result.emailError}`);
      } else {
        toast.success("Notification sent successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Failed to create notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (notificationId: Id<"notifications">) => {
    try {
      await deleteNotification({ notificationId });
      toast.success("Notification deleted");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const toggleUserSelection = (userId: Id<"users">) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  if (notifications === undefined || users === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create New Notification Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isCreating ? "Create New Notification" : "Notifications"}
            </h2>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + New Notification
              </button>
            )}
          </div>
        </div>

        {isCreating && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Notification title"
              />
            </div>

            {/* Content */}
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Content (Markdown supported)
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Write your message here...&#10;&#10;**Bold text** and *italic text* are supported.&#10;- Bullet lists&#10;- [Links](https://example.com)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Supports: **bold**, *italic*, `code`, [links](url), headers (#, ##, ###), lists (-, *), and code blocks (```)
              </p>
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recipients
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sendToAll}
                    onChange={() => {
                      setSendToAll(true);
                      setSelectedUsers([]);
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    All users
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!sendToAll}
                    onChange={() => setSendToAll(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Select specific users
                  </span>
                </label>
              </div>

              {!sendToAll && (
                <div className="mt-3 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                  {users.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                      No users available
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {users.map((user: { id: Id<"users">; name: string; email: string }) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="text-blue-600 focus:ring-blue-500 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {user.name}
                          </span>
                          {user.email !== user.name && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({user.email})
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Send Email Option */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="text-blue-600 focus:ring-blue-500 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Also send as email
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : "Send Notification"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Existing Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sent Notifications ({notifications.length})
          </h2>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-500 dark:text-gray-400">
              No notifications sent yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification: any) => (
              <div key={notification._id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Sent by {notification.creatorName} on{" "}
                        {new Date(notification.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        To: {notification.recipientCount}
                      </span>
                      <span>•</span>
                      <span>
                        Read by: {notification.readCount}
                      </span>
                      {notification.sendEmail && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400">
                            📧 Email sent
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {showDeleteConfirm === notification._id ? (
                      <>
                        <button
                          onClick={() => handleDelete(notification._id)}
                          className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(notification._id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                        title="Delete notification"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
