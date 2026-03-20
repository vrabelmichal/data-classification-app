import type { Dispatch, SetStateAction } from "react";

export interface SettingsFormState {
  allowAnonymous: boolean;
  emailFrom: string;
  appName: string;
  debugAdminMode: boolean;
  allowPublicOverview: boolean;
  appVersion: string;
  failedFittingMode: "checkbox" | "legacy";
  failedFittingFallbackLsbClass: number;
  showAwesomeFlag: boolean;
  showValidRedshift: boolean;
  showVisibleNucleus: boolean;
  defaultImageQuality: "high" | "low";
  galaxyBrowserImageQuality: "high" | "low";
  availablePapers: string[];
  userExportLimit: number;
  overviewDefaultPaper: string | null;
  cloudflareCachePurgeEnabled: boolean;
  cloudflareZoneId: string;
  cloudflareApiToken: string;
}

export interface SettingsTabProps {
  systemSettings: any;
}

export interface CloudflareCachePurgeStatus {
  hasCredentials: boolean;
  missingCredentials?: string[];
  available: boolean;
}

export type HandleSettingChange = <K extends keyof SettingsFormState>(
  key: K,
  value: SettingsFormState[K],
) => void;

export interface SettingsPageProps {
  localSettings: SettingsFormState;
  handleSettingChange: HandleSettingChange;
}

export interface PapersOverviewSettingsPageProps extends SettingsPageProps {
  setLocalSettings: Dispatch<SetStateAction<SettingsFormState>>;
  newPaperInput: string;
  setNewPaperInput: Dispatch<SetStateAction<string>>;
}

export interface OperationsSettingsPageProps extends SettingsPageProps {
}

export interface CloudflareSettingsPageProps extends SettingsPageProps {
  cloudflareCachePurgeStatus: CloudflareCachePurgeStatus | undefined;
}