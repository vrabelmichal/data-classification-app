import { renderAdditionalDetails } from "./detailRenderers";
import type { GalaxyData } from "./types";

interface GalaxyInfoProps {
  displayGalaxy: GalaxyData;
  showAdditionalDetails: boolean;
  additionalDetails: any;
  loadingDetails: boolean;
  onToggleDetails: () => void;
}

export function GalaxyInfo({
  displayGalaxy,
  showAdditionalDetails,
  additionalDetails,
  loadingDetails,
  onToggleDetails,
}: GalaxyInfoProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-300">
        <div>
          <span className="font-medium">RA:</span> {displayGalaxy.ra.toFixed(4)}°
        </div>
        <div>
          <span className="font-medium">Dec:</span> {displayGalaxy.dec.toFixed(4)}°
        </div>
        <div>
          <span className="font-medium">
            r<sub>eff</sub>:
          </span>{" "}
          {displayGalaxy.reff.toFixed(2)}″ ({displayGalaxy.reff_pixels.toFixed(2)} pixels)
        </div>
        <div>
          <span className="font-medium">q:</span> {displayGalaxy.q.toFixed(3)}
        </div>
        <div>
          <span className="font-medium">PA:</span> {displayGalaxy.pa.toFixed(1)}°
        </div>
        <div>
          <span className="font-medium">Nucleus:</span> {displayGalaxy.nucleus ? "Yes" : "No"}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
          onClick={onToggleDetails}
          disabled={loadingDetails}
        >
          {loadingDetails ? 'Loading...' : (showAdditionalDetails ? 'Hide details' : 'Show details')}
        </button>
      </div>
      {renderAdditionalDetails(additionalDetails, showAdditionalDetails)}
    </div>
  );
}
