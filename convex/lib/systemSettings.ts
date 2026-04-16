import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DEFAULT_SYSTEM_SETTINGS } from "./defaults";

type SettingsContext = QueryCtx | MutationCtx;

export async function loadMergedSystemSettings(ctx: SettingsContext) {
  const settings = await ctx.db.query("systemSettings").collect();

  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key as keyof typeof DEFAULT_SYSTEM_SETTINGS] = setting.value;
    return acc;
  }, {} as Partial<typeof DEFAULT_SYSTEM_SETTINGS>);

  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...settingsMap,
  } as typeof DEFAULT_SYSTEM_SETTINGS;
}