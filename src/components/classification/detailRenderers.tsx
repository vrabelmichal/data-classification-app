/**
 * Helper functions for rendering additional galaxy details
 */

const shouldIncludeKey = (key: string) => 
  !key.startsWith("_") && key !== "band" && key !== "galaxyRef";

const formatNumber = (val: number) => {
  if (Math.abs(val) >= 1000 || Math.abs(val) < 1e-3) return val.toExponential(3);
  return val.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
};

const renderKeyVal = (label: string, value: any, idx?: number) => {
  if (value === null || value === undefined) return null;
  const stripeClass = idx !== undefined ? (idx % 2 === 0 ? 'bg-white dark:bg-gray-900/60' : 'bg-gray-50 dark:bg-gray-800/40') : '';
  // Normalize display for special cases
  let displayValue: string;
  if (typeof value === 'number') {
    displayValue = formatNumber(value);
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (typeof value === 'string') {
    // Remove leading b'' or b"" wrapper for tilename & similar values coming from buffer stringifications
    if (label.toLowerCase() === 'tilename') {
      const m = value.match(/^b['"](.*)['"]$/s);
      if (m) value = m[1];
    }
    displayValue = value;
  } else {
    displayValue = String(value);
  }

  const isDataset = label.toLowerCase() === 'dataset';
  const valueSpanClass = isDataset
    ? 'font-medium text-gray-900 dark:text-gray-100 truncate max-w-[12rem] md:max-w-[18rem] lg:max-w-[24rem]'
    : 'font-medium text-gray-900 dark:text-gray-100';
  const valueTitle = isDataset ? displayValue : undefined;
  return (
    <div
      key={label}
      className={`flex justify-between items-center text-[11px] py-1 px-2 ${stripeClass} border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors`}
    >
      <span className="text-gray-500 dark:text-gray-400 mr-2">{label}</span>
      <span title={valueTitle} className={valueSpanClass}>
        {displayValue}
      </span>
    </div>
  );
};

export const renderSersic = (sersic: any, showPsf: boolean = true) => {
  if (!sersic) return null;
  return (
    <div className="mt-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
        Sersic
      </div>
      {Object.entries(sersic)
        .filter(([k]) => shouldIncludeKey(k) && k !== 'psf')
        .map(([k, v], i) => renderKeyVal(k, v as any, i))}
      {showPsf && sersic.psf && (
        <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">
            PSF
          </div>
          {Object.entries(sersic.psf)
            .filter(([k]) => shouldIncludeKey(k))
            .map(([k, v], i) => renderKeyVal(k, v as any, i))}
        </div>
      )}
    </div>
  );
};

export const renderPhotometryBlock = (label: string, block: any, showPsf: boolean = true) => {
  if (!block) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
        {label}
      </div>
      {renderSersic(block.sersic, showPsf)}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
              .map(([k, v], i) => renderKeyVal(k, v as any, i))}
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
          .map(([k, v], i) => renderKeyVal(k, v as any, i))}
      </div>
    </div>
  );
};

export const renderMisc = (misc: any) => {
  // if (!misc) return null;
  if (!misc) {
    return (
      <div className="w-full md:w-1/3">
        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
          Misc
        </div>
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            No miscellaneous details available.
          </div>
        </div>
      </div>
    )
  }
  // Only show a selected subset of misc fields per request
  const keysToShow = ['is_detr', 'is_vit', 'paper', 'dataset', 'tilename', 'thur_cls'];
  const entries = keysToShow
    .filter((k) => misc[k] !== undefined && misc[k] !== null)
    .map((k) => [k, misc[k]] as [string, any]);
  if (!entries.length) return null;
  return (
    <div className="w-full md:w-1/3">
      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
        Misc
      </div>
      <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
        {entries.map(([k, v], i) => renderKeyVal(k, v, i))}
      </div>
    </div>
  );
};

export const renderAdditionalDetails = (
  additionalDetails: any,
  showAdditionalDetails: boolean,
  showPsf: boolean = true
) => {
  if (!additionalDetails || !showAdditionalDetails) return null;
  return (
    <div className="mt-4 text-xs text-gray-700 dark:text-gray-200">
      {/* Photometry Section – 3 columns */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
          Photometry
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {renderPhotometryBlock('g-band', additionalDetails.photometry_g, showPsf)}
          {renderPhotometryBlock('r-band', additionalDetails.photometry_r, showPsf)}
          {renderPhotometryBlock('i-band', additionalDetails.photometry_i, showPsf)}
        </div>
      </div>
      {/* Source Extractor */}
      {renderSourceExtractor(additionalDetails.source_extractor)}
      {/* Thuruthipilly */}
      {renderThuruthipilly(additionalDetails.thuruthipilly)}
      {/* Misc – 1/3 width */}
      <div className="flex gap-3">
        {renderMisc(additionalDetails.misc)}
      </div>
    </div>
  );
};
