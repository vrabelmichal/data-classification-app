import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnalysisLoadSection } from "../src/components/statistics/analysis/DataAnalysisOverviewSections";

function AnalysisLoadSectionHarness({
  initialDraftName = "Analysis 1",
}: {
  initialDraftName?: string;
}) {
  const [draftName, setDraftName] = useState(initialDraftName);
  const normalizedName = draftName.trim().length > 0 ? draftName.trim() : "Analysis 1";

  return (
    <AnalysisLoadSection
      summary={{
        totalGalaxies: 0,
        totalClassifications: 0,
        catalogNucleusGalaxies: 0,
        availablePapers: [],
      }}
      hasDataset={false}
      hasStoredDataset={false}
      storedDatasetRecordCount={0}
      storedDatasetSavedAtLabel={null}
      datasetNotice={null}
      loadedRecordsCount={0}
      loadedAtLabel={null}
      loadedSource={null}
      loadState={{
        status: "idle",
        phase: "idle",
        galaxiesLoaded: 0,
        classificationRowsLoaded: 0,
        error: null,
        cancelled: false,
      }}
      onLoadDataset={vi.fn()}
      onLoadStoredDataset={vi.fn()}
      onCancelLoad={vi.fn()}
      onSaveDatasetToStorage={vi.fn()}
      onDownloadDatasetArchive={vi.fn()}
      onImportDatasetFile={vi.fn()}
      onClearStoredDataset={vi.fn()}
      onExportReport={vi.fn()}
      onExportJson={vi.fn()}
      canDownloadDatasetArchive={false}
      canImportDatasetArchive={true}
      canExportReport={false}
      analysisSetupName={normalizedName}
      analysisSetupDraftName={draftName}
      analysisSetupOptions={[]}
      selectedAnalysisSetupKey={null}
      hasSavedAnalysisSetup={false}
      savedAnalysisSetupCount={0}
      analysisSetupStatusMessage="Using the built-in local defaults."
      analysisSetupStatusTone="neutral"
      isAnalysisSetupLoading={false}
      isAnalysisSetupSaving={false}
      onSelectAnalysisSetup={vi.fn()}
      onChangeAnalysisSetupName={setDraftName}
      onSaveAnalysisSetup={vi.fn()}
      onSaveAsNewAnalysisSetup={vi.fn()}
      onLoadAnalysisSetup={vi.fn()}
      onRestoreDefaultAnalysisSetup={vi.fn()}
    />
  );
}

describe("AnalysisLoadSection", () => {
  it("keeps the setup name input empty after the user clears it", async () => {
    const user = userEvent.setup();

    render(<AnalysisLoadSectionHarness />);

    const input = screen.getByLabelText(/Setup name/i);
    await user.clear(input);

    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Analysis 1")).toBeTruthy();
  });

  it("preserves typed spaces in the setup name input while editing", async () => {
    const user = userEvent.setup();

    render(<AnalysisLoadSectionHarness initialDraftName="" />);

    const input = screen.getByLabelText(/Setup name/i);
    await user.type(input, "Draft setup ");

    expect((input as HTMLInputElement).value).toBe("Draft setup ");
  });
});