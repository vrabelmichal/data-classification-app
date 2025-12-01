import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function TestEmailSection() {
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const sendTestEmail = useAction(api.testEmail.sendTestEmail);
  const settings = useQuery(api.system_settings.getSystemSettings);

  const handleSendTestEmail = async () => {
    if (!recipientEmail.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setSending(true);
      setLastResult(null);
      
      const result = await sendTestEmail({ recipientEmail: recipientEmail.trim() });
      
      setLastResult(result);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send test email";
      toast.error(errorMessage);
      setLastResult({
        success: false,
        message: "Error",
        details: errorMessage,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-cyan-600 dark:text-cyan-400 mb-4">📧 Test Email (Resend API)</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Send a test email to verify your Resend API configuration is working correctly. 
        This simulates the password reset email flow.
      </p>

      {/* Current configuration info */}
      {settings && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            <strong>From:</strong> {settings.appName || "Galaxy Classification App"} &lt;{settings.emailFrom || "noreply@galaxies.michalvrabel.sk"}&gt;
          </p>
        </div>
      )}

      {/* Email input */}
      <div className="mb-4">
        <label htmlFor="test-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Recipient Email
        </label>
        <input
          id="test-email"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="test@example.com"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
                     placeholder-gray-400 dark:placeholder-gray-500"
          disabled={sending}
        />
      </div>

      {/* Send button */}
      <button
        onClick={() => void (async () => { await handleSendTestEmail(); })()}
        disabled={sending || !recipientEmail.trim()}
        className="inline-flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 
                   disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium 
                   py-2 px-4 rounded-lg transition-colors"
      >
        {sending && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {sending ? "Sending..." : "Send Test Email"}
      </button>

      {/* Result display */}
      {lastResult && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            lastResult.success
              ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
          }`}
        >
          <p
            className={`font-medium ${
              lastResult.success
                ? "text-green-800 dark:text-green-200"
                : "text-red-800 dark:text-red-200"
            }`}
          >
            {lastResult.success ? "✓" : "✗"} {lastResult.message}
          </p>
          {lastResult.details && (
            <p
              className={`mt-1 text-xs ${
                lastResult.success
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {lastResult.details}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
