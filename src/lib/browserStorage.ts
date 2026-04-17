export const CLASSIFICATION_COMMENT_DRAFT_STORAGE_PREFIX = "classification.commentDraft.v1:";

export interface LocalStorageItemDescription {
  title: string;
  description: string;
  deleteEffect: string;
  known: boolean;
  groupId: "global" | "classification" | "browse" | "notifications" | "statistics" | "data" | "admin" | "unknown";
  groupLabel: string;
  kind: "item" | "commentDraft";
}

export const LOCAL_STORAGE_GROUP_ORDER: Record<LocalStorageItemDescription["groupId"], number> = {
  global: 0,
  classification: 1,
  browse: 2,
  notifications: 3,
  statistics: 4,
  data: 5,
  admin: 6,
  unknown: 7,
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readLocalStorageValue(key: string): string | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageValue(key: string, value: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write failures.
  }
}

function removeLocalStorageValue(key: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage removal failures.
  }
}

export function buildClassificationCommentDraftStorageKey(userId: string | null | undefined, galaxyId: string | null | undefined): string | null {
  if (!userId || !galaxyId) {
    return null;
  }

  return `${CLASSIFICATION_COMMENT_DRAFT_STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(galaxyId)}`;
}

export function parseClassificationCommentDraftStorageKey(key: string): { userId: string; galaxyId: string } | null {
  if (!key.startsWith(CLASSIFICATION_COMMENT_DRAFT_STORAGE_PREFIX)) {
    return null;
  }

  const suffix = key.slice(CLASSIFICATION_COMMENT_DRAFT_STORAGE_PREFIX.length);
  const separatorIndex = suffix.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  const encodedUserId = suffix.slice(0, separatorIndex);
  const encodedGalaxyId = suffix.slice(separatorIndex + 1);

  try {
    return {
      userId: decodeURIComponent(encodedUserId),
      galaxyId: decodeURIComponent(encodedGalaxyId),
    };
  } catch {
    return null;
  }
}

export function getClassificationCommentDraft(userId: string | null | undefined, galaxyId: string | null | undefined): string {
  const key = buildClassificationCommentDraftStorageKey(userId, galaxyId);
  if (!key) {
    return "";
  }

  return readLocalStorageValue(key) ?? "";
}

export function setClassificationCommentDraft(userId: string | null | undefined, galaxyId: string | null | undefined, comment: string): void {
  const key = buildClassificationCommentDraftStorageKey(userId, galaxyId);
  if (!key) {
    return;
  }

  if (!comment.trim()) {
    removeLocalStorageValue(key);
    return;
  }

  writeLocalStorageValue(key, comment);
}

export function clearClassificationCommentDraft(userId: string | null | undefined, galaxyId: string | null | undefined): void {
  const key = buildClassificationCommentDraftStorageKey(userId, galaxyId);
  if (!key) {
    return;
  }

  removeLocalStorageValue(key);
}

function getTableSettingsLabel(prefix: string): string {
  if (prefix === "usersStats") {
    return "Per-user statistics table";
  }

  if (prefix === "data.classifications") {
    return "Classification export table";
  }

  if (prefix === "adminData.classifications") {
    return "Admin classifications table";
  }

  return "Saved table view";
}

export function describeLocalStorageItem(key: string): LocalStorageItemDescription {
  if (key === "theme") {
    return {
      title: "Appearance theme",
      description: "Remembers whether this browser should use the light, dark, or system theme.",
      deleteEffect: "Deleting it may temporarily reset the theme until your saved account preference or browser preference is applied again.",
      known: true,
      groupId: "global",
      groupLabel: "Global",
      kind: "item",
    };
  }

  if (key === "showEllipseOverlay") {
    return {
      title: "Ellipse overlay toggle",
      description: "Remembers whether galaxy images show the ellipse overlay in the classification interface.",
      deleteEffect: "Deleting it resets that toggle to the app default the next time you open classification.",
      known: true,
      groupId: "classification",
      groupLabel: "Classification",
      kind: "item",
    };
  }

  if (key === "showMasks") {
    return {
      title: "Mask overlay toggle",
      description: "Remembers whether masked galaxy images are shown in the classification interface.",
      deleteEffect: "Deleting it resets that toggle to the app default the next time you open classification.",
      known: true,
      groupId: "classification",
      groupLabel: "Classification",
      kind: "item",
    };
  }

  if (key === "galaxyBrowserSettings") {
    return {
      title: "Galaxy browser filters",
      description: "Stores your last-used galaxy browser filters, sorting, search values, and page options in this browser.",
      deleteEffect: "Deleting it clears those saved browser controls and the galaxy browser will open with default values again.",
      known: true,
      groupId: "browse",
      groupLabel: "Browse Galaxies",
      kind: "item",
    };
  }

  if (key === "galaxyQuickReview:selectedImageKey") {
    return {
      title: "Quick review image choice",
      description: "Remembers which image layer you last selected in galaxy quick review.",
      deleteEffect: "Deleting it resets quick review to its default image selection.",
      known: true,
      groupId: "browse",
      groupLabel: "Browse Galaxies",
      kind: "item",
    };
  }

  if (key === "notifications_view_mode") {
    return {
      title: "Notifications layout",
      description: "Remembers how notifications are displayed in this browser.",
      deleteEffect: "Deleting it resets the notifications page to its default view mode.",
      known: true,
      groupId: "notifications",
      groupLabel: "Notifications",
      kind: "item",
    };
  }

  if (key === "statistics.dataAnalysis.dataset.v1") {
    return {
      title: "Data analysis dataset cache",
      description: "Stores a browser-local copy of the client-side classification analysis dataset so it can be reloaded without fetching every page from the database again.",
      deleteEffect: "Deleting it removes the saved browser copy of the analysis dataset. The live database data is not changed.",
      known: true,
      groupId: "statistics",
      groupLabel: "Statistics",
      kind: "item",
    };
  }

  if (key === "generateBalancedUserSequenceLogs") {
    return {
      title: "Admin sequence generation logs",
      description: "Stores the recent log output from the balanced user sequence admin tool in this browser.",
      deleteEffect: "Deleting it only clears the saved browser copy of those logs.",
      known: true,
      groupId: "admin",
      groupLabel: "Admin",
      kind: "item",
    };
  }

  if (key === "updateUserSequenceLogs") {
    return {
      title: "Admin sequence update logs",
      description: "Stores the recent log output from the user sequence update admin tool in this browser.",
      deleteEffect: "Deleting it only clears the saved browser copy of those logs.",
      known: true,
      groupId: "admin",
      groupLabel: "Admin",
      kind: "item",
    };
  }

  if (key === "data.classifications.exportColumns.v1") {
    return {
      title: "Classification export columns",
      description: "Remembers which classification columns you selected for CSV export.",
      deleteEffect: "Deleting it resets the export column picker to its default selection.",
      known: true,
      groupId: "data",
      groupLabel: "Data",
      kind: "item",
    };
  }

  if (key.startsWith("__convexAuthJWT_")) {
    return {
      title: "Convex sign-in session",
      description: "Keeps you signed in to this app by storing a short-lived authentication token for Convex.",
      deleteEffect: "Deleting it will usually sign you out in this browser or force the app to re-authenticate.",
      known: true,
      groupId: "global",
      groupLabel: "Global",
      kind: "item",
    };
  }

  if (key.startsWith("__convexAuthRefreshToken_")) {
    return {
      title: "Convex sign-in refresh token",
      description: "Helps keep your sign-in session active in this browser without asking you to log in again too often.",
      deleteEffect: "Deleting it will usually sign you out in this browser or shorten how long your current session lasts.",
      known: true,
      groupId: "global",
      groupLabel: "Global",
      kind: "item",
    };
  }

  const commentDraft = parseClassificationCommentDraftStorageKey(key);
  if (commentDraft) {
    return {
      title: `Galaxy ${commentDraft.galaxyId}`,
      description: "Stores a comment you started writing for one galaxy so it can be restored if you leave and come back before submitting a classification.",
      deleteEffect: "Deleting it removes that unfinished comment draft from this browser only. Submitted classifications are not affected.",
      known: true,
      groupId: "classification",
      groupLabel: "Classification",
      kind: "commentDraft",
    };
  }

  const visibleColumnsMatch = key.match(/^(.*)\.visibleColumns\.v1$/);
  if (visibleColumnsMatch) {
    const prefix = visibleColumnsMatch[1];
    const groupId =
      prefix === "usersStats"
        ? "statistics"
        : prefix === "data.classifications"
          ? "data"
          : prefix === "adminData.classifications"
            ? "admin"
            : "unknown";
    const groupLabel =
      groupId === "statistics"
        ? "Statistics"
        : groupId === "data"
          ? "Data"
          : groupId === "admin"
            ? "Admin"
            : "Unknown or legacy";

    return {
      title: `${getTableSettingsLabel(prefix)} columns`,
      description: "Remembers which columns are visible in a table on this site.",
      deleteEffect: "Deleting it resets that table's visible columns to the default layout.",
      known: true,
      groupId,
      groupLabel,
      kind: "item",
    };
  }

  const sortMatch = key.match(/^(.*)\.sort\.v1$/);
  if (sortMatch) {
    const prefix = sortMatch[1];
    const groupId =
      prefix === "usersStats"
        ? "statistics"
        : prefix === "data.classifications"
          ? "data"
          : prefix === "adminData.classifications"
            ? "admin"
            : "unknown";
    const groupLabel =
      groupId === "statistics"
        ? "Statistics"
        : groupId === "data"
          ? "Data"
          : groupId === "admin"
            ? "Admin"
            : "Unknown or legacy";

    return {
      title: `${getTableSettingsLabel(prefix)} sorting`,
      description: "Remembers the last sorting choice for a table on this site.",
      deleteEffect: "Deleting it resets that table's sorting to the default order.",
      known: true,
      groupId,
      groupLabel,
      kind: "item",
    };
  }

  return {
    title: "Saved browser item",
    description: "This is a value saved by this site in your browser. It may come from a current feature, an older version of the app, or a page you visited earlier.",
    deleteEffect: "Deleting it only affects this browser. If the feature still uses it, the app may recreate it later.",
    known: false,
    groupId: "unknown",
    groupLabel: "Unknown or legacy",
    kind: "item",
  };
}