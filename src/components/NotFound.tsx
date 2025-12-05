import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-4">🌌</div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          404
        </h1>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Lost in Space
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has drifted beyond the observable universe.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔬 Start Classifying
          </Link>
          <Link
            to="/browse"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            🌌 Browse Galaxies
          </Link>
        </div>
      </div>
    </div>
  );
}
