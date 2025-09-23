// Placeholder provider for password reset via OTP/email.
// Implement actual email sending (Resend, etc.) by adding dependencies and environment variables.
// @ts-ignore - optional dependency; ensure you install `@auth/core` and `resend` for full functionality
import Resend from "@auth/core/providers/resend";
// @ts-ignore - optional dependency; remove ignore after adding package
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-reset",
  // apiKey: process.env.AUTH_RESEND_KEY,
  apiKey: process.env.CONVEX_RESEND_API_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    const length = 8;
    return generateRandomString(random, alphabet, length);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    // Basic plain text email; customize as needed.
    const { error } = await resend.emails.send({
      from: "Galaxy App <no-reply@yourdomain.com>",
      to: [email],
      subject: `Reset your password`,
      text: "Your password reset code is " + token,
    });
    if (error) {
      console.error("Resend email error:", error);
      throw new Error(`Could not send reset email: ${error.message || JSON.stringify(error)}`);
    }
  },
});
