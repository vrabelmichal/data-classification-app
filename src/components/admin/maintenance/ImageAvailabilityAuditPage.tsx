import { ImageAvailabilityAuditPanel } from "../../imageAudit/ImageAvailabilityAuditPanel";
import { usePageTitle } from "../../../hooks/usePageTitle";

export function ImageAvailabilityAuditPage() {
  usePageTitle("Admin – Image Availability");
  return (
    <section>
      <h2 className="border-b border-gray-200 pb-2 text-xl font-bold text-gray-900 dark:border-gray-700 dark:text-white">
        Image Availability Audit
      </h2>
      <p className="mb-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
        Audit the classification image set against object storage, persist progress in batches, and review or resume saved runs.
      </p>
      <ImageAvailabilityAuditPanel />
    </section>
  );
}