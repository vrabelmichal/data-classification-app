// Placeholder provider for password reset via OTP/email.
// Implement actual email sending (Resend, etc.) by adding dependencies and environment variables.
// @ts-ignore - optional dependency; ensure you install `@auth/core` and `resend` for full functionality
import Resend from "@auth/core/providers/resend";
// @ts-ignore - optional dependency; remove ignore after adding package
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

// Shared token generation
function generateResetToken() {
  const random: RandomReader = {
    read(bytes) {
      crypto.getRandomValues(bytes);
    },
  };
  const alphabet = "0123456789";
  const length = 8;
  return generateRandomString(random, alphabet, length);
}

// Shared email sending
async function sendResetEmail(email: string, token: string, apiKey: string, from: string = "Galaxy App <noreply@galaxies.michalvrabel.sk>") {
  const resend = new ResendAPI(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: `Reset your password`,
    text: `Your password reset code is ${token}. Use this code in the password reset form.`,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error(`Could not send reset email: ${error.message || JSON.stringify(error)}`);
  }
}

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    return generateResetToken();
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    await sendResetEmail(email, token, provider.apiKey!);
  },
});

// Helper function to send password reset email manually
export async function sendPasswordResetEmail(email: string, from?: string) {
  const token = generateResetToken();
  await sendResetEmail(email, token, process.env.AUTH_RESEND_KEY!, from);
  return token; // Optionally return the token if needed
}
