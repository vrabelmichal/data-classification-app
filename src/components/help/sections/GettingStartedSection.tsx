import { KidsExamplesCarousel } from "../KidsExamplesCarousel";

type GettingStartedSectionProps = {
  appName: string;
};

export function GettingStartedSection({ appName }: GettingStartedSectionProps) {
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">🚀</span>
          Getting Started
        </h2>
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p>
            Welcome to {appName}. This workflow has three onboarding stages before regular classification:
            registration, waiting for approval, and waiting for sequence generation.
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Create your account and confirm your email address.</li>
            <li>Wait for admin approval so your account becomes active for labeling.</li>
            <li>
              Wait until your galaxy sequence is generated. You may receive an email notification when it is
              ready, depending on notification settings applied when the sequence is generated.
            </li>
            <li>
              Review and label the shown galaxy data (set class, morphology, and flags; add optional notes;
              then submit or skip if unsure).
            </li>
          </ol>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sequence size is not fixed permanently and can be extended or reduced later by project settings.
          </p>
        </div>
      </div>
      <KidsExamplesCarousel />
    </>
  );
}
