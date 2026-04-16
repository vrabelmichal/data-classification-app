import { lazy, Suspense, type ReactNode } from "react";
import { ClassificationInterface } from "../classification/ClassificationInterface";
import { AccessDenied, LoadingScreen } from "./AppStatus";
import type { UserRole } from "../../lib/permissions";

export interface AppNavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  element: ReactNode;
  isVisible?: boolean;
  hasNestedRoutes?: boolean;
  isExternallyRouted?: boolean;
  activeWhenPathStartsWith?: string[];
  inactiveWhenPathStartsWith?: string[];
}

interface UserPermissions {
  accessDataPage?: boolean;
  viewIssueReports?: boolean;
  canAccessAdminPanel?: boolean;
}

interface UserProfile {
  role?: UserRole;
  permissions?: UserPermissions;
  canAccessAdminPanel?: boolean;
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

const LazyPasswordReset = lazy(() =>
  import("../../PasswordReset").then((module) => ({ default: module.PasswordReset }))
);
const LazyGalaxyBrowser = lazy(() =>
  import("../browse/GalaxyBrowser").then((module) => ({ default: module.GalaxyBrowser }))
);
const LazySkippedGalaxies = lazy(() =>
  import("../browse/SkippedGalaxies").then((module) => ({ default: module.SkippedGalaxies }))
);
const LazyStatistics = lazy(() =>
  import("../statistics/Statistics").then((module) => ({ default: module.Statistics }))
);
const LazyUserSettings = lazy(() =>
  import("../settings/UserSettings").then((module) => ({ default: module.UserSettings }))
);
const LazyHelp = lazy(() =>
  import("../help/Help").then((module) => ({ default: module.Help }))
);
const LazyDataPage = lazy(() =>
  import("../data/DataPage").then((module) => ({ default: module.DataPage }))
);
const LazyAdminPanel = lazy(() =>
  import("../admin/AdminPanel").then((module) => ({ default: module.AdminPanel }))
);
const LazyIssueReportsPage = lazy(() =>
  import("../admin/IssueReportsPage").then((module) => ({ default: module.IssueReportsPage }))
);
const LazyNotificationsPage = lazy(() =>
  import("../notifications/NotificationsPage").then((module) => ({ default: module.NotificationsPage }))
);
const LazyNotFound = lazy(() =>
  import("../NotFound").then((module) => ({ default: module.NotFound }))
);

const browseRoute = (
  <LazyPage>
    <LazyGalaxyBrowser />
  </LazyPage>
);

const skippedRoute = (
  <LazyPage>
    <LazySkippedGalaxies />
  </LazyPage>
);

const statisticsRoute = (
  <LazyPage>
    <LazyStatistics />
  </LazyPage>
);

const settingsRoute = (
  <LazyPage>
    <LazyUserSettings />
  </LazyPage>
);

const notificationsRoute = (
  <LazyPage>
    <LazyNotificationsPage />
  </LazyPage>
);

const helpRoute = (
  <LazyPage>
    <LazyHelp />
  </LazyPage>
);

const adminPanelRoute = (
  <LazyPage>
    <LazyAdminPanel />
  </LazyPage>
);

const issueReportsRoute = (
  <LazyPage>
    <LazyIssueReportsPage />
  </LazyPage>
);

const passwordResetRoute = (
  <LazyPage>
    <LazyPasswordReset />
  </LazyPage>
);

const notFoundRoute = (
  <LazyPage>
    <LazyNotFound />
  </LazyPage>
);

export function getAppNavigationItems(
  userProfile: UserProfile | null | undefined
): AppNavigationItem[] {
  const permissions = userProfile?.permissions;
  const canAccessDataPage = Boolean(permissions?.accessDataPage);
  const canViewIssueReports = Boolean(permissions?.viewIssueReports);
  const canAccessAdminPanel = Boolean(
    permissions?.canAccessAdminPanel ?? userProfile?.canAccessAdminPanel
  );

  const dataRoute = canAccessDataPage ? (
    <LazyPage>
      <LazyDataPage />
    </LazyPage>
  ) : (
    <AccessDenied message="You need data access permissions to use the data section." />
  );

  const reportsRoute = canViewIssueReports ? (
    issueReportsRoute
  ) : (
    <AccessDenied message="You need issue-report access to view this page." />
  );

  const adminRoute = canAccessAdminPanel ? (
    adminPanelRoute
  ) : (
    <AccessDenied message="You do not have access to any admin panel sections." />
  );

  return [
    { id: "classify", label: "Classify", icon: "🔬", path: "/classify", element: <ClassificationInterface />, isVisible: true },
    { id: "browse", label: "Browse Galaxies", icon: "🌌", path: "/browse", element: browseRoute, isVisible: true },
    { id: "skipped", label: "Skipped", icon: "⏭️", path: "/skipped", element: skippedRoute, isVisible: true },
    { id: "statistics", label: "Statistics", icon: "📊", path: "/statistics", element: statisticsRoute, isVisible: true, hasNestedRoutes: true },
    {
      id: "data",
      label: "Data",
      icon: "🗂️",
      path: "/data",
      element: dataRoute,
      isVisible: canAccessDataPage,
      hasNestedRoutes: true,
      activeWhenPathStartsWith: ["/data"],
    },
    { id: "notifications", label: "Notifications", icon: "🔔", path: "/notifications", element: notificationsRoute, isVisible: true, hasNestedRoutes: true },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", element: settingsRoute, isVisible: true, hasNestedRoutes: true, activeWhenPathStartsWith: ["/settings"] },
    { id: "help", label: "Help", icon: "❓", path: "/help", element: helpRoute, isVisible: true, hasNestedRoutes: true },
    { id: "reports", label: "Issue Reports", icon: "📋", path: "/reports", element: reportsRoute, isVisible: canViewIssueReports },
    { id: "admin", label: "Admin", icon: "👑", path: "/admin", element: adminRoute, isVisible: canAccessAdminPanel, isExternallyRouted: true },
  ];
}

export { adminPanelRoute, notFoundRoute, passwordResetRoute };