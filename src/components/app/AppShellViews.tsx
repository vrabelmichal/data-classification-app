import { Link, Navigate, Route, Routes } from "react-router";
import { ReportIssueModalProvider, useReportIssueModal } from "../../lib/reportIssueModalContext";
import { ReportIssueModal } from "../ReportIssueModal";
import { Navigation } from "../layout/Navigation";
import { ClassificationInterface } from "../classification/ClassificationInterface";
import { SignInForm } from "../../SignInForm";
import type { AppNavigationItem } from "./appRoutes";

function GlobalReportIssueModal() {
  const { isOpen, close } = useReportIssueModal();
  return <ReportIssueModal isOpen={isOpen} onClose={close} />;
}

function getNavigationRoutePath(item: AppNavigationItem) {
  return item.id === "statistics" || item.id === "help" || item.id === "notifications" || item.id === "data" || item.id === "settings"
    ? `${item.path}/*`
    : item.path;
}

interface UnauthenticatedAppViewProps {
  appName: string;
  passwordResetRoute: React.ReactNode;
}

interface AuthenticatedAppViewProps {
  appName: string;
  navigationItems: AppNavigationItem[];
  adminPanelRoute: React.ReactNode;
  notFoundRoute: React.ReactNode;
}

export function UnauthenticatedAppView({ appName, passwordResetRoute }: UnauthenticatedAppViewProps) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {appName}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Help classify galaxies for scientific research
            </p>
          </div>
          <Routes>
            <Route path="/reset" element={passwordResetRoute} />
            <Route
              path="*"
              element={
                <>
                  <SignInForm />
                  <div className="mt-6 text-center">
                    <Link
                      to="/reset"
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export function AuthenticatedAppView({
  appName,
  navigationItems,
  adminPanelRoute,
  notFoundRoute,
}: AuthenticatedAppViewProps) {
  return (
    <ReportIssueModalProvider>
      <GlobalReportIssueModal />
      <div className="flex flex-col custom-lg:flex-row min-h-screen overflow-x-hidden">
        <Navigation navigationItems={navigationItems} appName={appName} />
        <div className="custom-lg:flex custom-lg:flex-1 custom-lg:flex-col custom-lg:ml-64 min-w-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            <Routes>
              <Route index element={<ClassificationInterface />} />
              <Route path="/reset" element={<Navigate to="/settings" replace />} />
              <Route path="/classify/:galaxyId" element={<ClassificationInterface />} />
              {navigationItems.filter((item) => item.id !== "admin").map((item) => (
                <Route
                  key={item.id}
                  path={getNavigationRoutePath(item)}
                  element={item.element}
                />
              ))}
              <Route path="/admin/*" element={adminPanelRoute} />
              <Route path="*" element={notFoundRoute} />
            </Routes>
          </div>
        </div>
      </div>
    </ReportIssueModalProvider>
  );
}