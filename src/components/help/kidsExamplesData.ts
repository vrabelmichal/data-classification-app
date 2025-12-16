/**
 * KiDS manual labeling example images data
 * Credit: H. Thuruthipilly et al.
 */

export interface KidsExampleImage {
  filename: string;
  title: string;
  alt: string;
  caption?: string;
}

export const kidsExampleImages: KidsExampleImage[] = [
  {
    filename: "00_is-this-an-lsb_decision-tree.avif",
    title: "Is this an LSB? (decision tree)",
    alt: "Decision tree for deciding whether an object is an LSB, non-LSB, or a failed fit.",
  },
  {
    filename: "01_failed-fitting_examples.avif",
    title: "Failed fitting — examples",
    alt: "Examples of failed galaxy model fits due to bad masks, large residuals, or model mismatch.",
  },
  {
    filename: "02_non-lsb_part-of-another-galaxy_obvious.avif",
    title: "Non-LSB — part of another galaxy (obvious)",
    alt: "Example where candidate clearly belongs to a larger nearby galaxy in the zoomed-out view.",
  },
  {
    filename: "03_non-lsb_part-of-another-galaxy_sometimes-not.avif",
    title: "Non-LSB — part of another galaxy (sometimes not)",
    alt: "Example showing candidate may be part of a nearby galaxy; inspect context carefully.",
  },
  {
    filename: "04_non-lsb_part-of-another-galaxy_open-aladin.avif",
    title: "Non-LSB — part of another galaxy (open Aladin)",
    alt: "Example where candidate may be part of another galaxy; includes guidance to check Aladin for context.",
  },
  {
    filename: "05_non-lsb_instrumental-artifact_ghosts-psf.avif",
    title: "Non-LSB — instrumental artifacts",
    alt: "Examples of instrumental artifacts such as ghosts or PSF structures mistaken for sources.",
  },
  {
    filename: "06_awesome-flag_weird-extraordinary_follow-up.avif",
    title: "Awesome flag — unusual objects",
    alt: "Examples of unusual or extraordinary objects that warrant follow-up even if fit looks acceptable.",
  },
  {
    filename: "07_morphology_overview.avif",
    title: "Morphology overview",
    alt: "Overview diagram describing morphology categories: spirals, ellipticals, featureless, and not sure.",
  },
  {
    filename: "08_spirals_ltg_examples.avif",
    title: "Spirals (LTG) — examples",
    alt: "Example spiral or elongated edge-on galaxies; observed and color panels.",
  },
  {
    filename: "09_ellipticals_etg_examples.avif",
    title: "Ellipticals (ETG) — examples",
    alt: "Example elliptical galaxies with central bulge; model and observed panels.",
  },
  {
    filename: "10_featureless_examples.avif",
    title: "Featureless — examples",
    alt: "Example panels of featureless faint objects with smooth profiles.",
  },
  {
    filename: "11_not-sure_examples.avif",
    title: "Not sure — examples",
    alt: "Example panels where morphology is uncertain; masked g-band, model, raw g-band, and color view.",
  },
];
