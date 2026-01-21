interface IconProps {
  className?: string;
  /** Optional width (px or CSS string) */
  width?: number | string;
  /** Optional height (px or CSS string) */
  height?: number | string;
  /** Optional unified size for height (px or CSS string) — width will be auto unless width is provided */
  size?: number | string;
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export function AladinLogo({ className, width, height, size }: IconProps) {
  const style: React.CSSProperties = {};
  if (size !== undefined) {
    style.height = typeof size === 'number' ? `${size}px` : size;
    style.width = 'auto';
  }
  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 15.67 7.64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(236.887,-241.01979)">
        <g transform="matrix(0.04968,0,0,0.04968,-231.156,235.769)">
          <path
            d="m -72.140726,146.18987 20.850002,66.60199 h -62.696006 l 13.525,-40.96699 h 16.602005 l -7.129,25.195 h 17.138999 l -18.065999,-50.83 z m 41.650001,0 v 50.83 h 22.8519956 v 15.771 H -48.654726 v -66.601 z"
            fill="currentColor"
          />
          <path
            d="m 32.205271,146.18987 20.85,66.60199 H -9.6397294 l 13.525,-40.96699 H 20.487271 l -7.129,25.195 h 17.139 l -18.066,-50.83 z m 23.486,0 h 21.875 c 4.753,0 9.017,0.578 12.793,1.732 3.776,1.155 7.129,2.903 10.058999,5.245 3.906,3.124 6.958,7.018 9.155,11.686 2.197,4.667 3.296,9.604 3.296,14.809 0,7.384 -2.197,14.02 -6.592,19.907 a 34.318,34.318 0 0 1 -6.762999,6.806 c -2.556,1.936 -5.184,3.35899 -7.886,4.27 -4.167,1.43199 -9.114,2.14699 -14.844,2.14699 h -21.094 v -40.96699 h 18.164 v 25.312 c 3.386,0 6.29,-0.40601 8.716,-1.219 2.425,-0.814 4.517,-2.082 6.274,-3.807 1.595,-1.594 2.856,-3.521 3.784,-5.781 0.928,-2.26 1.392,-4.545 1.392,-6.854 0,-2.277 -0.472,-4.554 -1.416,-6.831 -0.944,-2.276 -2.214,-4.211 -3.809,-5.805 -1.758,-1.756 -3.769,-3 -6.03,-3.732 -2.263,-0.731 -5.249,-1.098 -8.96,-1.098 h -18.115 v -15.82 z m 82.030999,0 v 15.82 h -18.164 v -15.82 z m 0,25.635 v 40.96699 h -18.164 v -40.96699 z m 8.008,-25.635 h 28.906 c 4.199,0 7.877,0.407 11.035,1.221 2.864,0.749 5.403,2.279 7.617,4.59 1.692,1.726 2.938,3.89 3.735,6.494 0.797,2.604 1.196,5.76 1.196,9.467 v 44.82999 h -18.164 v -43.95199 c 0,-2.276 -0.40702,-3.935 -1.221,-4.975 -1.01,-1.236 -3.061,-1.854 -6.152,-1.854 h -8.789 v 50.78099 h -18.164 v -66.60199 z"
            fill="currentColor"
          />
        </g>
      </g>
    </svg>
  );
}

// no default export — only named icon components

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function EllipseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <ellipse
        cx="12"
        cy="12"
        rx="8"
        ry="4"
        transform="rotate(-45 12 12)"
      />
    </svg>
  );
}
