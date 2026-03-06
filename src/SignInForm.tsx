"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

const PASSWORD_MIN_LENGTH = 8;

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        method="post"
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);

          const password = (formData.get("password") as string) ?? "";
          // Only enforce minimum length on sign-up; existing users may have
          // shorter passwords and must not be blocked from signing in.
          if (flow === "signUp" && password.length < PASSWORD_MIN_LENGTH) {
            toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
            return;
          }

          setSubmitting(true);
          try {
            await signIn("password", formData);
          } catch (error) {
            // Log the full error so the real cause is always recorded for debugging.
            console.error("[SignInForm] signIn error:", error);

            const message = (error as Error)?.message?.toLowerCase() ?? "";
            // Prefer an explicit error code/type over text-matching when available.
            const errorCode =
              (error as { code?: string })?.code ??
              (error as { type?: string })?.type ??
              "";

            // NOTE: The "too short" / "minimum" text match is a best-effort
            // heuristic because the auth provider does not always expose a
            // structured error code for password-length violations.  This
            // intentionally avoids the generic "invalid password" phrase so we
            // don't misclassify a wrong-password error as a length error.
            const passwordTooShort =
              errorCode === "password_too_short" ||
              message.includes("too short") ||
              message.includes("minimum") ||
              (message.includes("password") && message.includes(`${PASSWORD_MIN_LENGTH}`));

            const credentialsInvalid = message.includes("invalid credentials");
            const invalidSecret =
              message.includes("invalidsecret") || message.includes("invalid secret");

            if (passwordTooShort) {
              toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
            } else if (credentialsInvalid && flow === "signIn") {
              toast.error("Email or password is incorrect.");
            } else if (invalidSecret) {
              toast.error(
                "Sign-in failed due to an account issue. Please try again or reset your password.",
              );
            } else {
              toast.error(
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?",
              );
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="username"
          required
        />
        {flow === "signUp" && (
          <input
            className="auth-input-field"
            type="text"
            name="name"
            placeholder="Full Name"
            autoComplete="name"
            required
          />
        )}
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200" />
        <span className="mx-4 text-secondary">or</span>
        <hr className="my-4 grow border-gray-200" />
      </div>
      {systemSettings?.allowAnonymous && (
        <button className="auth-button" onClick={() => void signIn("anonymous")}>
          Sign in anonymously
        </button>
      )}
    </div>
  );
}
