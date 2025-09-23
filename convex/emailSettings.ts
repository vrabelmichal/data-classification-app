import { query } from "./_generated/server";

// Public query: return only the fields needed by the email provider
export const getSystemSettingsForEmail = query({
  args: {},
  handler: async (ctx): Promise<{ appName: string; emailFrom: string }> => {
    const settings = await ctx.db.query("systemSettings").collect();
    const settingsMap = settings.reduce((acc: Record<string, any>, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    const appName = settingsMap.appName ?? "Galaxy Classification App";
    const emailFrom = settingsMap.emailFrom ?? "noreply@galaxies.michalvrabel.sk";
    return { appName, emailFrom };
  },
});