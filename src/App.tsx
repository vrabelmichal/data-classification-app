import { useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Navigation } from "./components/Navigation";
import { ClassificationInterface } from "./components/ClassificationInterface";
import { GalaxyBrowser } from "./components/GalaxyBrowser";
import { SkippedGalaxies } from "./components/SkippedGalaxies";
import { Statistics } from "./components/Statistics";
import { UserSettings } from "./components/UserSettings";
import { Help } from "./components/Help";
import { AdminPanel } from "./components/AdminPanel";
import { Toaster } from "sonner";

function App() {
  const [currentPage, setCurrentPage] = useState("classify");

  const renderPage = () => {
    switch (currentPage) {
      case "classify":
        return <ClassificationInterface />;
      case "browse":
        return <GalaxyBrowser />;
      case "table":
        return <GalaxyBrowser />;
      case "skipped":
        return <SkippedGalaxies />;
      case "statistics":
        return <Statistics />;
      case "settings":
        return <UserSettings />;
      case "help":
        return <Help />;
      case "admin":
        return <AdminPanel />;
      default:
        return <ClassificationInterface />;
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  let renderedContent;
  if (isMobile) {
    renderedContent = (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto">
              {renderPage()}
            </div>
          </div>
        );
  } 
  else {
    renderedContent = (
        <div className="lg:flex lg:flex-1 lg:flex-col lg:ml-64">
          <div className="flex items-center justify-end px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <SignOutButton />
          </div>
          
          <div className="flex-1 overflow-auto">
            {renderPage()}
          </div>
        </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Galaxy Classifier
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Help classify galaxies for scientific research
                </p>
              </div>
              <SignInForm />
            </div>
          </div>
        </div>
      </Unauthenticated>
      
      <Authenticated>
        {/* <div className="flex h-screen"> */}
				<div className="flex flex-col lg:flex-row h-screen">
          <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
          {renderedContent}
        </div>
      </Authenticated>
      
      <Toaster position="top-right" />
    </main>
  );
}

export default App;
