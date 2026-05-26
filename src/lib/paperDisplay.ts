/** Metadata for a single paper identifier stored in system settings. */
export interface PaperMetadataEntry {
  id: string;
  label?: string;
  citation?: string;
}

/**
 * Returns the human-readable label for a paper identifier.
 *
 * If `metadata` contains an entry for `paperId` with a non-empty `label`,
 * that label is returned. Otherwise falls back to the identifier itself
 * (or "Unassigned" for the empty-string identifier).
 */
export function getPaperLabel(
  paperId: string,
  metadata?: PaperMetadataEntry[],
): string {
  if (metadata) {
    const entry = metadata.find((m) => m.id === paperId);
    if (entry?.label) {
      return entry.label;
    }
  }
  return paperId === "" ? "Unassigned" : paperId;
}

/**
 * Returns the citation text for a paper identifier, or undefined if none configured.
 */
export function getPaperCitation(
  paperId: string,
  metadata?: PaperMetadataEntry[],
): string | undefined {
  if (!metadata) return undefined;
  const entry = metadata.find((m) => m.id === paperId);
  return entry?.citation || undefined;
}
