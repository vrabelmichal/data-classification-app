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
async function sendResetEmail(email: string, token: string, apiKey: string, appName: string, from: string) {
  // const resend = new ResendAPI(apiKey);
  // console.log("API Key:", apiKey);
  // console.log("From address:", from);
  // console.log("Sending reset email to:", email);
  // console.log("Reset token:", token);

  // Get the app URL from environment or use a default
  const appUrl = process.env.SITE_URL || "http://localhost:5173";

  // Send the email using fetch to emulate curl
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${appName} Password Reset`,
      text: `Your password reset code is ${token}. Use this code in the password reset form.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>You requested a password reset for your account.</p>
          <p style="margin: 32px 0; font-size: 2em; font-weight: bold; letter-spacing: 0.2em; color: #007bff; text-align: center;">
            ${token}
          </p>
          <p>Enter this code in the password reset form to continue.</p>
          <p>If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">If you need help, contact support.</p>
        </div>
      `,
      // html: `
      //   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      //     <h2 style="color: #333;">Reset Your Password</h2>
      //     <p>Hello,</p>
      //     <p>You requested a password reset for your account. Click the button below to reset your password:</p>
      //     <div style="text-align: center; margin: 30px 0;">
      //       <a href="${appUrl}/reset?token=${token}"
      //          style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      //         Reset Password
      //       </a>
      //     </div>
      //     <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      //     <p style="word-break: break-all; color: #666;">${appUrl}/reset?token=${token}</p>
      //     <p><strong>Reset code:</strong> ${token}</p>
      //     <p>This link will expire. If you didn't request this reset, please ignore this email.</p>
      //     <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      //     <p style="color: #666; font-size: 12px;">If you're having trouble, contact support.</p>
      //   </div>
      // `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Resend email error:", error);
    throw new Error(`Could not send reset email: ${error}`);
  }

  // Old code using Resend API (commented out)
  // const { error } = await resend.emails.send({
  //   from,
  //   to: [email],
  //   subject: `Reset your password`,
  //   text: `Your password reset code is ${token}. Use this code in the password reset form.`,
  // });

  // if (error) {
  //   console.error("Resend email error:", error);
  //   throw new Error(`Could not send reset email: ${error.message || JSON.stringify(error)}`);
  // }
}

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    return generateResetToken();
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    try {
      const url = `${process.env.CONVEX_CLOUD_URL}/api/query`;
      console.log("Fetching system settings from:", url);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "emailSettings:getSystemSettingsForEmail",
          args: {},
          format: "json"
        }),
      });

      // Read the response body once
      const responseText = await res.text();
      console.log("System settings response:", responseText);

      if (!res.ok) {
        console.error("Failed to fetch system settings:", responseText);
        const appName = "Galaxy Classification App";
        const from = "noreply@galaxies.michalvrabel.sk";
        const fromWithName = `${appName} <${from}>`;
        await sendResetEmail(email, token, provider.apiKey!, appName, fromWithName);
        return;
      }

      // Parse the JSON from the text we already read
      const responseData = JSON.parse(responseText) as { status: string; value: { appName?: string; emailFrom?: string } };
      const settings = responseData.value;
      const appName = settings?.appName ?? "Galaxy Classification App";
      const from = settings?.emailFrom ?? "noreply@galaxies.michalvrabel.sk";
      const fromWithName = `${appName} <${from}>`;
      await sendResetEmail(email, token, provider.apiKey!, appName, fromWithName);
    } catch (err) {
      console.error("Error fetching system settings:", err);
      const appName = "Galaxy Classification App";
      const from = "noreply@galaxies.michalvrabel.sk";
      const fromWithName = `${appName} <${from}>`;
      await sendResetEmail(email, token, provider.apiKey!, appName, fromWithName);
    }
  },
});

// Helper function to send password reset email manually
export async function sendPasswordResetEmail(email: string, from: string, appName?: string) {
  const token = generateResetToken();
  const appNameToUse = appName || "Galaxy Classification App";
  const fromWithName = `${appNameToUse} <${from}>`;
  await sendResetEmail(email, token, process.env.AUTH_RESEND_KEY!, appNameToUse, fromWithName);
  return token; // Optionally return the token if needed
}
