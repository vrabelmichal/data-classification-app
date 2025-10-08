/**
 * Helper functions for rendering additional galaxy details
 */

const shouldIncludeKey = (key: string) => 
  !key.startsWith("_") && key !== "band" && key !== "galaxyRef";

const formatNumber = (val: number) => {
  if (Math.abs(val) >= 1000 || Math.abs(val) < 1e-3) return val.toExponential(3);
  return val.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
};

const renderKeyVal = (label: string, value: any) => {
  if (value === null || value === undefined) return null;
  return (
    <div key={label} className="flex justify-between text-[11px] py-0.5">
      <span className="text-gray-500 dark:text-gray-400 mr-2">{label}</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        {typeof value === 'number' ? formatNumber(value) : String(value)}
      </span>
    </div>
  );
};

export const renderSersic = (sersic: any) => {
  if (!sersic) return null;
  return (
    <div className="mt-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
        Sersic
      </div>
      {Object.entries(sersic)
        .filter(([k]) => shouldIncludeKey(k) && k !== 'psf')
        .map(([k, v]) => renderKeyVal(k, v as any))}
      {sersic.psf && (
        <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
            PSF
          </div>
          {Object.entries(sersic.psf)
            .filter(([k]) => shouldIncludeKey(k))
            .map(([k, v]) => renderKeyVal(k, v as any))}
        </div>
      )}
    </div>
  );
};

export const renderPhotometryBlock = (label: string, block: any) => {
  if (!block) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
        Photometry ({label})
      </div>
      {renderSersic(block.sersic)}
    </div>
  );
};

export const renderSourceExtractor = (doc: any) => {
  if (!doc) return null;
  const bandKeys = ['g','r','i','y','z'];
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
        Source Extractor
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {bandKeys.filter(k => doc[k]).map(band => (
          <div 
            key={band} 
            className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
              {band}-band
            </div>
            {Object.entries(doc[band])
              .filter(([k]) => shouldIncludeKey(k))
              .map(([k, v]) => renderKeyVal(k, v as any))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const renderThuruthipilly = (doc: any) => {
  if (!doc) return null;
  return (
    <div className="mb-1">
      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
        Thuruthipilly
      </div>
      <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
        {Object.entries(doc)
          .filter(([k]) => shouldIncludeKey(k))
          .map(([k, v]) => renderKeyVal(k, v as any))}
      </div>
    </div>
  );
};

export const renderAdditionalDetails = (additionalDetails: any, showAdditionalDetails: boolean) => {
  if (!additionalDetails || !showAdditionalDetails) return null;
  return (
    <div className="mt-4 text-xs text-gray-700 dark:text-gray-200">
      {renderPhotometryBlock('g-band', additionalDetails.photometry_g)}
      {renderPhotometryBlock('r-band', additionalDetails.photometry_r)}
      {renderPhotometryBlock('i-band', additionalDetails.photometry_i)}
      {renderSourceExtractor(additionalDetails.source_extractor)}
      {renderThuruthipilly(additionalDetails.thuruthipilly)}
    </div>
  );
};
