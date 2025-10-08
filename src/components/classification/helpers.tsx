import { ALLOWED_QUICK_INPUT_CHARS } from "./constants";

/**
 * Parse quick input string and extract classification values
 * Handles any order of characters: flags (a,r,n) can be anywhere,
 * LSB and morphology are determined by position in the non-flag characters
 */
export function parseQuickInput(input: string) {
  const cleanInput = input.toLowerCase().trim();
  if (!cleanInput) {
    return {
      lsbClass: null,
      morphology: null,
      awesomeFlag: false,
      validRedshift: false,
      visibleNucleus: false,
    };
  }

  // Extract flags (can be anywhere in the string)
  const awesomeFlag = cleanInput.includes('a');
  const validRedshift = cleanInput.includes('r');
  const visibleNucleus = cleanInput.includes('n');

  // Extract only the LSB/morphology characters (-, 0, 1, 2)
  // by filtering out the flag characters
  const lsbMorphChars = cleanInput
    .split('')
    .filter(char => char === '-' || char === '0' || char === '1' || char === '2')
    .join('');

  // First character is LSB class
  let lsbClass = null;
  if (lsbMorphChars.length > 0) {
    const lsbChar = lsbMorphChars[0];
    if (lsbChar === '-') lsbClass = -1;
    else if (lsbChar === '0') lsbClass = 0;
    else if (lsbChar === '1') lsbClass = 1;
  }

  // Second character is morphology
  let morphology = null;
  if (lsbMorphChars.length > 1) {
    const morphChar = lsbMorphChars[1];
    if (morphChar === '-') morphology = -1;
    else if (morphChar === '0') morphology = 0;
    else if (morphChar === '1') morphology = 1;
    else if (morphChar === '2') morphology = 2;
  }

  return {
    lsbClass,
    morphology,
    awesomeFlag,
    validRedshift,
    visibleNucleus,
  };
}

/**
 * Build quick input string from classification values
 */
export function buildQuickInputString(
  lsb: number | null,
  morph: number | null,
  awesome: boolean,
  redshift: boolean,
  nucleus: boolean = false
) {
  let str = "";
  if (lsb !== null) str += lsb === -1 ? "-" : lsb.toString();
  if (morph !== null) str += morph === -1 ? "-" : morph.toString();
  if (redshift) str += "r";
  if (awesome) str += "a";
  if (nucleus) str += "n";
  return str;
}

/**
 * Filter input to only allow valid quick input characters
 */
export function filterQuickInput(value: string): string {
  return value.split('').filter(char => ALLOWED_QUICK_INPUT_CHARS.test(char)).join('');
}

/**
 * Get priority for sorting images based on number of columns
 */
export function getImagePriority(key: string, numColumns: number, defaultPreviewImageName: string): number {
  if (numColumns === 3) return 0; // default order
  if (key.includes('g_') && key.includes('_masked')) return 1;
  if (numColumns === 1) {
    if (key === defaultPreviewImageName) return 2;
    if (key.includes('residual')) return 3;
    if (key.includes('aplpy') && key !== defaultPreviewImageName) return 4;
    if (key.includes('model')) return 5;
  } else if (numColumns === 2) {
    if (key.includes('residual')) return 2;
    if (key === defaultPreviewImageName) return 3;
    if (key.includes('aplpy') && key !== defaultPreviewImageName) return 4;
    if (key.includes('model')) return 5;
  }
  return 6; // fallback
}

/**
 * Process image label to make parenthetical parts small
 */
export function processImageLabel(label: string): React.ReactNode {
  const lines = label.split('\n');
  if (lines.length === 2 && lines[1].startsWith('(') && lines[1].endsWith(')')) {
    return (
      <>
        {lines[0]}
        <br />
        <small className="text-xs">{lines[1]}</small>
      </>
    );
  }
  return label;
}

/**
 * Check if an image should show the ellipse overlay
 */
export function shouldShowEllipse(imageName: string, showEllipseOverlay: boolean): boolean {
  return imageName.includes("Masked g-Band") && showEllipseOverlay;
}
