import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

export function PasswordReset() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"request" | { email: string }>("request");
  const [submitting, setSubmitting] = useState(false);

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
              toast.error(err.message || "Failed to send reset code");
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
          })
          .catch((err) => {
            toast.error(err.message || "Failed to reset password");
            setSubmitting(false);
          });
      }}
    >
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Enter code & new password</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">We sent a code to {step.email}. Enter it below.</p>
      <input
        name="code"
        type="text"
        required
        placeholder="Reset code"
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
