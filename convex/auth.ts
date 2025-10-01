import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query } from "./_generated/server";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { getOptionalUserId } from "./lib/auth";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: ResendOTPPasswordReset }), Anonymous],
});

// NOTE: We intentionally removed direct admin password setting helper to enforce
// a single password reset flow via email code. Admins can only trigger an email
// (see users.resetUserPassword) instead of viewing or setting passwords.

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
