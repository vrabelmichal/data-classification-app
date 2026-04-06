import { lazy, Suspense, type ReactNode } from "react";
import { ClassificationInterface } from "../classification/ClassificationInterface";
import { AccessDenied, LoadingScreen } from "./AppStatus";

export interface AppNavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  element: ReactNode;
  adminOnly?: boolean;
  activeWhenPathStartsWith?: string[];
  inactiveWhenPathStartsWith?: string[];
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

export function getAppNavigationItems(isAdmin: boolean): AppNavigationItem[] {
  const dataRoute = isAdmin ? (
    <LazyPage>
      <LazyDataPage />
    </LazyPage>
  ) : (
    <AccessDenied message="You need administrator privileges to access the data section." />
  );

  return [
    { id: "classify", label: "Classify", icon: "🔬", path: "/classify", element: <ClassificationInterface /> },
    { id: "browse", label: "Browse Galaxies", icon: "🌌", path: "/browse", element: browseRoute },
    { id: "skipped", label: "Skipped", icon: "⏭️", path: "/skipped", element: skippedRoute },
    { id: "statistics", label: "Statistics", icon: "📊", path: "/statistics", element: statisticsRoute },
    {
      id: "data",
      label: "Data",
      icon: "🗂️",
      path: "/data",
      element: dataRoute,
      adminOnly: true,
      activeWhenPathStartsWith: ["/data"],
    },
    { id: "notifications", label: "Notifications", icon: "🔔", path: "/notifications", element: notificationsRoute },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", element: settingsRoute, activeWhenPathStartsWith: ["/settings"] },
    { id: "help", label: "Help", icon: "❓", path: "/help", element: helpRoute },
    { id: "reports", label: "Issue Reports", icon: "📋", path: "/reports", element: issueReportsRoute, adminOnly: true },
    { id: "admin", label: "Admin", icon: "👑", path: "/admin", element: adminPanelRoute, adminOnly: true },
  ];
}

export { adminPanelRoute, notFoundRoute, passwordResetRoute };