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
            const errorCode =
              (error as { code?: string })?.code ??
              (error as { type?: string })?.type ??
              "";

            const passwordTooShort =
              errorCode === "password_too_short" ||
              message.includes("too short") ||
              message.includes("minimum") ||
              message.includes("invalid password");

            const credentialsInvalid =
              message.includes("invalid credentials") ||
              message.includes("invalidsecret") ||
              message.includes("invalid secret");

            const rateLimited =
              message.includes("rate limit") ||
              message.includes("too many") ||
              message.includes("toomanyfailedattempts");

            const accountNotFound =
              message.includes("invalidaccountid") ||
              message.includes("could not find");

            if (rateLimited) {
              toast.error(
                "Too many failed attempts. Please wait a few minutes before trying again.",
              );
            } else if (passwordTooShort && flow === "signUp") {
              toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
            } else if (accountNotFound && flow === "signIn") {
              toast.error(
                "No account found for this email. Check your email address or sign up instead.",
              );
            } else if (credentialsInvalid && flow === "signIn") {
              toast.error(
                "Email or password is incorrect. If you've forgotten your password, use the reset link below.",
              );
            } else {
              const hint =
                flow === "signIn"
                  ? "Could not sign in. Please check your credentials or try resetting your password."
                  : "Could not sign up. An account with this email may already exist — try signing in instead.";
              toast.error(hint);
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
