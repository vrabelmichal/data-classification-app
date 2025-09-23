import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

export function PasswordReset() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"request" | { email: string }>("request");
  const [submitting, setSubmitting] = useState(false);
  const [tokenFromUrl, setTokenFromUrl] = useState<string>("");

  // Check for token in URL on component mount
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setTokenFromUrl(token);
      // If we have a token, skip to the verification step
      setStep({ email: "" }); // We'll get email from the form or user input
    }
  }, [searchParams]);

  if (step === "request") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", "reset");
          void signIn("password", formData)
            .then(() => {
              toast.success("Reset code sent (check email)");
              setStep({ email: formData.get("email") as string });
            })
            .catch((err) => {
              console.error("Password reset request error:", err); // Keep debugging details in console

              // Provide user-friendly error messages
              let userMessage = "Failed to send reset code";

              if (err.message) {
                const errorMsg = err.message.toLowerCase();

                if (errorMsg.includes("not found") || errorMsg.includes("email")) {
                  userMessage = "Email address not found. Please check your email and try again.";
                } else if (errorMsg.includes("rate limit") || errorMsg.includes("too many")) {
                  userMessage = "Too many requests. Please wait a few minutes and try again.";
                } else if (errorMsg.includes("invalid email")) {
                  userMessage = "Please enter a valid email address.";
                }
              }

              toast.error(userMessage);
            })
            .finally(() => setSubmitting(false));
        }}
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Forgot password</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Enter your email and we'll send you a reset code.</p>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg"
        >
          {submitting ? "Sending..." : "Send reset code"}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.currentTarget);
        formData.set("flow", "reset-verification");
        formData.set("email", step.email);
        void signIn("password", formData)
          .then(() => {
            toast.success("Password updated, you are now signed in");
            navigate("/");
          })
          .catch((err) => {
            console.error("Password reset error:", err); // Keep debugging details in console

            // Provide user-friendly error messages
            let userMessage = "Failed to reset password";

            if (err.message) {
              const errorMsg = err.message.toLowerCase();

              if (errorMsg.includes("invalid") || errorMsg.includes("verification")) {
                userMessage = "Invalid or expired reset code. Please request a new one.";
              } else if (errorMsg.includes("not found") || errorMsg.includes("email")) {
                userMessage = "Email address not found. Please check your email and try again.";
              } else if (errorMsg.includes("expired") || errorMsg.includes("timeout")) {
                userMessage = "Reset code has expired. Please request a new one.";
              } else if (errorMsg.includes("already used")) {
                userMessage = "This reset code has already been used. Please request a new one.";
              } else if (errorMsg.includes("too many")) {
                userMessage = "Too many attempts. Please wait a few minutes and try again.";
              }
            }

            toast.error(userMessage);
            setSubmitting(false);
          });
      }}
    >
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Enter code & new password</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {tokenFromUrl
          ? "Enter your email and new password to complete the reset."
          : `We sent a code to ${step.email}. Enter it below.`
        }
      </p>
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      <input
        name="code"
        type="text"
        required
        placeholder="Reset code"
        defaultValue={tokenFromUrl}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      <input
        name="newPassword"
        type="password"
        required
        placeholder="New password"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep("request")}
          className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-medium py-2 px-4 rounded-lg"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg"
        >
          {submitting ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </form>
  );
}
