import { SignOutButton } from "../SignOutButton";

export function AccountPendingConfirmation() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Account Under Review
          </h1>

          <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
            Your account is pending confirmation by an administrator
          </p>

          <div className="text-gray-600 dark:text-gray-300 mb-8 space-y-3">
            <p>
              Thank you for registering for the Galaxy Classification App. Once your account is confirmed, you'll have access to classify galaxies and contribute to scientific research.
            </p>
            <p>
              We'll notify you by email as soon as your account is activated.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-center space-x-2">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-amber-800 dark:text-amber-200 font-medium">Awaiting confirmation</span>
            </div>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            <p className="mb-2">This usually takes up to 48 hours.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <SignOutButton />
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200 font-medium"
            >
              Refresh Status
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Galaxy Classification App • Scientific Research Platform
          </p>
        </div>
      </div>
    </div>
  );
}