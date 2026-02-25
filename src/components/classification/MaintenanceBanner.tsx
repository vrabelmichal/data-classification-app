export function MaintenanceBanner() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-700 text-white px-4 py-3 shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
        <svg
          aria-hidden="true"
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        <span className="font-semibold text-white">
          New classifications are temporarily disabled for scheduled maintenance. You can still browse galaxies.
        </span>
      </div>
    </div>
  );
}
