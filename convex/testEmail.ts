import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Send a test email to verify Resend API configuration.
 * This action is for debugging purposes to test if password reset emails would work.
 */
export const sendTestEmail = action({
  args: {
    recipientEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string; details?: string }> => {
    // Check admin permissions
    const userIdentity = await ctx.auth.getUserIdentity();
    if (!userIdentity) {
      throw new Error("Not authenticated");
    }

    // Get the user profile to check admin status
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Get system settings for email configuration
    const settings = await ctx.runQuery(api.system_settings.getSystemSettings);
    const emailFrom = settings.emailFrom || "noreply@galaxies.michalvrabel.sk";
    const appName = settings.appName || "Galaxy Classification App";

    // Check if API key is configured
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "Resend API key not configured",
        details: "The AUTH_RESEND_KEY environment variable is not set. Please configure it in your Convex dashboard.",
      };
    }

    // Generate a test code similar to password reset
    const testCode = Math.random().toString().slice(2, 10);
    const fromWithName = `${appName} <${emailFrom}>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromWithName,
          to: [args.recipientEmail],
          subject: `${appName} - Test Email`,
          text: `This is a test email from ${appName}. If you received this, your email configuration is working correctly! Test code: ${testCode}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">🧪 Test Email</h2>
              <p>Hello,</p>
              <p>This is a <strong>test email</strong> from <strong>${appName}</strong>.</p>
              <p>If you received this email, your Resend API configuration is working correctly!</p>
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #0369a1;"><strong>Configuration Details:</strong></p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #0369a1;">
                  <li>From: ${fromWithName}</li>
                  <li>To: ${args.recipientEmail}</li>
                  <li>Test Code: <code style="background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">${testCode}</code></li>
                </ul>
              </div>
              <p style="color: #666;">This email was sent from the Admin Debugging panel to verify email delivery is working.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">Sent by ${appName} • Resend API Test</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Resend API error:", errorText);
        
        // Try to parse the error for better messaging
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.message || errorJson.error || errorText;
        } catch {
          // Keep the raw text if not JSON
        }

        return {
          success: false,
          message: "Failed to send test email",
          details: `Resend API returned status ${res.status}: ${errorDetails}`,
        };
      }

      const responseData = await res.json();
      
      return {
        success: true,
        message: `Test email sent successfully to ${args.recipientEmail}`,
        details: `Email ID: ${responseData.id || "unknown"}`,
      };
    } catch (error) {
      console.error("Error sending test email:", error);
      return {
        success: false,
        message: "Error sending test email",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
