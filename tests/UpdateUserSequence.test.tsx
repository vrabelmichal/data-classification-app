import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAction,
  useMutation,
  useQuery,
  type ReactAction,
  type ReactMutation,
} from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../convex/_generated/api";
import { UpdateUserSequence } from "../src/components/admin/UpdateUserSequence";

vi.mock("convex/react", () => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    galaxies: {
      sequence: {
        getUsersWithSequences: "getUsersWithSequences",
      },
    },
    updateUserSequence: {
      getUserSequenceInfo: "getUserSequenceInfo",
      shortenUserSequence: "shortenUserSequence",
      extendUserSequence: "extendUserSequence",
      assignGalaxyIdsToSequence: "assignGalaxyIdsToSequence",
      updateExtendedSequenceStats: "updateExtendedSequenceStats",
      updateManualSequenceAssignmentStats: "updateManualSequenceAssignmentStats",
      sendSequenceShortenedEmail: "sendSequenceShortenedEmail",
      sendSequenceExtendedEmail: "sendSequenceExtendedEmail",
    },
    classificationBasedAssignment: {
      extendSequenceByClassificationTarget: "extendSequenceByClassificationTarget",
    },
  },
}));

const useQueryMock = vi.mocked(useQuery);
const useMutationMock = vi.mocked(useMutation);
const useActionMock = vi.mocked(useAction);

function toMutationMock<Mutation extends FunctionReference<"mutation">>(
  mockFn: ReturnType<typeof vi.fn>
): ReactMutation<Mutation> {
  return Object.assign(mockFn, {
    withOptimisticUpdate: vi.fn().mockReturnValue(mockFn),
  }) as unknown as ReactMutation<Mutation>;
}

function toActionMock<Action extends FunctionReference<"action">>(
  mockFn: ReturnType<typeof vi.fn>
): ReactAction<Action> {
  return mockFn as unknown as ReactAction<Action>;
}

function configureUpdateHooks(options?: {
  usersWithSequences?: any[];
  sequenceInfo?: any;
  extendAction?: ReturnType<typeof vi.fn>;
  balancedExtendMutation?: ReturnType<typeof vi.fn>;
  manualAssignMutation?: ReturnType<typeof vi.fn>;
  manualStatsMutation?: ReturnType<typeof vi.fn>;
  sendExtendedEmail?: ReturnType<typeof vi.fn>;
}) {
  const sequenceInfo = options?.sequenceInfo ?? {
    totalGalaxies: 10,
    currentIndex: 2,
    numClassified: 2,
    numSkipped: 0,
    remaining: 8,
  };
  const getUserSequenceInfo = vi.fn().mockResolvedValue(sequenceInfo);
  const shortenUserSequence = vi.fn();
  const extendUserSequence = options?.balancedExtendMutation ?? vi.fn();
  const assignGalaxyIdsToSequence = options?.manualAssignMutation ?? vi.fn();
  const updateExtendedSequenceStats = vi.fn();
  const updateManualSequenceAssignmentStats =
    options?.manualStatsMutation ?? vi.fn().mockResolvedValue({ success: true, totalProcessed: 2, isComplete: true });
  const extendClassification = options?.extendAction ?? vi.fn();
  const sendSequenceShortenedEmail = vi.fn();
  const sendSequenceExtendedEmail =
    options?.sendExtendedEmail ?? vi.fn().mockResolvedValue({ success: true, to: "user@example.com" });

  useQueryMock.mockImplementation((...hookArgs) => {
    const [reference] = hookArgs;
    switch (reference) {
      case api.galaxies.sequence.getUsersWithSequences:
        return options?.usersWithSequences ?? [];
      default:
        return undefined;
    }
  });

  useMutationMock.mockImplementation((reference) => {
    switch (reference) {
      case api.updateUserSequence.getUserSequenceInfo:
        return toMutationMock(getUserSequenceInfo);
      case api.updateUserSequence.shortenUserSequence:
        return toMutationMock(shortenUserSequence);
      case api.updateUserSequence.extendUserSequence:
        return toMutationMock(extendUserSequence);
      case api.updateUserSequence.assignGalaxyIdsToSequence:
        return toMutationMock(assignGalaxyIdsToSequence);
      case api.updateUserSequence.updateExtendedSequenceStats:
        return toMutationMock(updateExtendedSequenceStats);
      case api.updateUserSequence.updateManualSequenceAssignmentStats:
        return toMutationMock(updateManualSequenceAssignmentStats);
      default:
        return toMutationMock(vi.fn());
    }
  });

  useActionMock.mockImplementation((reference) => {
    switch (reference) {
      case api.classificationBasedAssignment.extendSequenceByClassificationTarget:
        return toActionMock(extendClassification);
      case api.updateUserSequence.sendSequenceShortenedEmail:
        return toActionMock(sendSequenceShortenedEmail);
      case api.updateUserSequence.sendSequenceExtendedEmail:
        return toActionMock(sendSequenceExtendedEmail);
      default:
        return toActionMock(vi.fn());
    }
  });

  return {
    getUserSequenceInfo,
    shortenUserSequence,
    extendUserSequence,
    assignGalaxyIdsToSequence,
    updateExtendedSequenceStats,
    updateManualSequenceAssignmentStats,
    extendClassification,
    sendSequenceExtendedEmail,
  };
}

function getNumberInputByLabelText(labelText: RegExp): HTMLInputElement {
  const label = screen.getByText(labelText).closest("label");
  const container = label?.parentElement;
  const input = container?.querySelector("input[type='number']");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Number input for ${labelText} not found`);
  }
  return input;
}

async function chooseUser(optionLabel: RegExp) {
  await userEvent.click(screen.getByRole("button", { name: /Select a user/i }));
  await userEvent.click(screen.getByRole("option", { name: optionLabel }));
}

describe("UpdateUserSequence", () => {
  const usersWithSequences = [
    {
      userId: "target-user",
      user: { name: "Target User", email: "target@example.com" },
      sequenceInfo: { galaxyCount: 10, numClassified: 2, currentIndex: 2, numSkipped: 0 },
    },
    {
      userId: "other-user",
      user: { name: "Other User", email: "other@example.com" },
      sequenceInfo: { galaxyCount: 7, numClassified: 1, currentIndex: 1, numSkipped: 0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("prefills expected users with the greater of 10 and the number of users with sequences", async () => {
    configureUpdateHooks({
      usersWithSequences: Array.from({ length: 12 }, (_, index) => ({
        userId: `user-${index}`,
        user: { name: `User ${index}`, email: `user-${index}@example.com` },
        sequenceInfo: { galaxyCount: 5, numClassified: 0, currentIndex: 0, numSkipped: 0 },
      })),
    });

    render(
      <UpdateUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await chooseUser(/User 0/i);
    await waitFor(() => expect(screen.getByText(/Current Sequence Status/i)).toBeTruthy());
    await userEvent.click(screen.getByLabelText(/Classification-based assignment/i));
    expect(getNumberInputByLabelText(/Expected Users \(N\)/i).value).toBe("12");
  });

  it("submits classification-based extension with an empty additional blacklist when no file is uploaded", async () => {
    const extendClassification = vi.fn().mockResolvedValue({
      success: true,
      requested: 50,
      generated: 3,
      previousSize: 10,
      newSequenceSize: 13,
      projectedNewSequenceSize: 13,
    });

    configureUpdateHooks({
      usersWithSequences,
      extendAction: extendClassification,
    });

    render(
      <UpdateUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await chooseUser(/Target User/i);
    await waitFor(() => expect(screen.getByText(/Current Sequence Status/i)).toBeTruthy());

    await userEvent.click(screen.getByLabelText(/Classification-based assignment/i));
    await userEvent.click(screen.getByRole("button", { name: /Extend Sequence \(Classification-Based\)/i }));

    await waitFor(() => expect(extendClassification).toHaveBeenCalledTimes(1));
    expect(extendClassification.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      additionalBlacklistedIds: [],
      excludedSequenceUserIds: [],
    });
  });

  it("passes uploaded blacklist ids, excluded sequence users, and classification-based email metadata on extend", async () => {
    const extendClassification = vi.fn().mockResolvedValue({
      success: true,
      requested: 50,
      generated: 2,
      previousSize: 10,
      newSequenceSize: 12,
      projectedNewSequenceSize: 12,
      selectedGalaxyIds: ["gal-1", "gal-2"],
      diagnostics: {
        effectiveBlacklistCount: 9,
        systemBlacklistedCount: 4,
        additionalBlacklistedCount: 2,
        excludedSequenceGalaxyCount: 3,
        excludedSequenceUserCount: 1,
        targetExistingSequenceCount: 10,
        classificationPrioritySelectedCount: 1,
        balancedFallbackSelectedCount: 1,
        balancedFallbackUnderAssignedCount: 1,
        balancedFallbackOverAssignedCount: 0,
      },
    });
    const sendSequenceExtendedEmail = vi.fn().mockResolvedValue({ success: true, to: "target@example.com" });

    configureUpdateHooks({
      usersWithSequences,
      extendAction: extendClassification,
      sendExtendedEmail: sendSequenceExtendedEmail,
    });

    const { container } = render(
      <UpdateUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await chooseUser(/Target User/i);
    await waitFor(() => expect(screen.getByText(/Current Sequence Status/i)).toBeTruthy());

    await userEvent.click(screen.getByLabelText(/Classification-based assignment/i));
    await userEvent.click(screen.getByLabelText(/Allow Over-Assign/i));
    await userEvent.click(screen.getByLabelText(/Other User/i));
    await userEvent.click(screen.getByLabelText(/Send email notification to user/i));

    const fileInput = container.querySelector("input[type='file']");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Blacklist file input not found");
    }
    await userEvent.upload(fileInput, new File(["gal-extra-1\ngal-extra-2\n"], "extend-blacklist.txt", { type: "text/plain" }));

    await userEvent.click(screen.getByRole("button", { name: /Extend Sequence \(Classification-Based\)/i }));

    await waitFor(() => expect(extendClassification).toHaveBeenCalledTimes(1));
    expect(extendClassification.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      allowOverAssign: true,
      additionalBlacklistedIds: ["gal-extra-1", "gal-extra-2"],
      excludedSequenceUserIds: ["other-user"],
    });

    expect(
      screen.getByText(/Exclusions resolved: currentSequence=10, effectiveBlacklist=9/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Selection details: classificationPriority=1, fallbackUnderK=1, overAssignFallback=0/i)
    ).toBeTruthy();

    await waitFor(() => expect(sendSequenceExtendedEmail).toHaveBeenCalledTimes(1));
    expect(sendSequenceExtendedEmail.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      galaxiesAdded: 2,
      procedureType: "classificationBased",
    });
  });

  it("forwards balanced dry-run extension and logs only the first five preview galaxies", async () => {
    const balancedExtendMutation = vi.fn().mockResolvedValue({
      success: true,
      requested: 50,
      generated: 6,
      previousSize: 10,
      newSequenceSize: 10,
      projectedNewSequenceSize: 16,
      selectedGalaxyIdsPreview: ["gal-1", "gal-2", "gal-3", "gal-4", "gal-5"],
      selectedGalaxyIdsCount: 6,
      statsBatchesNeeded: 0,
    });
    const sendSequenceExtendedEmail = vi.fn().mockResolvedValue({ success: true, to: "target@example.com" });

    const { extendUserSequence, updateExtendedSequenceStats } = configureUpdateHooks({
      usersWithSequences,
      balancedExtendMutation,
      sendExtendedEmail: sendSequenceExtendedEmail,
    });

    render(
      <UpdateUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await chooseUser(/Target User/i);
    await waitFor(() => expect(screen.getByText(/Current Sequence Status/i)).toBeTruthy());

    await userEvent.click(screen.getByLabelText(/Send email notification to user/i));
    await userEvent.click(screen.getByLabelText(/Dry run only/i));
    await userEvent.click(screen.getByRole("button", { name: /Dry Run Extend Sequence/i }));

    await waitFor(() => expect(extendUserSequence).toHaveBeenCalledTimes(1));
    expect(extendUserSequence.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      dryRun: true,
    });

    expect(updateExtendedSequenceStats).not.toHaveBeenCalled();
    expect(sendSequenceExtendedEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/Showing first 5 of 6 galaxies that would be added/i)).toBeTruthy();
    expect(screen.getByText(/Dry-run preview galaxies: gal-1, gal-2, gal-3, gal-4, gal-5/i)).toBeTruthy();
    expect(screen.queryByText(/gal-6/i)).toBeNull();
  });

  it("submits manual galaxy IDs through the integrated third extension procedure", async () => {
    const manualAssignMutation = vi.fn().mockResolvedValue({
      success: true,
      createdSequence: false,
      uniqueRequestedCount: 3,
      previousSize: 10,
      newSequenceSize: 12,
      addedCount: 2,
      statsStartIndex: 10,
      statsBatchesNeeded: 1,
      statsBatchSize: 500,
      selectedGalaxyIdsPreview: ["gal-7", "gal-8"],
      selectedGalaxyIdsCount: 2,
      warnings: ["Skipped 1 IDs already present in the user's current sequence."],
    });
    const sendSequenceExtendedEmail = vi.fn().mockResolvedValue({ success: true, to: "target@example.com" });

    const { updateManualSequenceAssignmentStats } = configureUpdateHooks({
      usersWithSequences,
      manualAssignMutation,
      sendExtendedEmail: sendSequenceExtendedEmail,
    });

    const { container } = render(
      <UpdateUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await chooseUser(/Target User/i);
    await waitFor(() => expect(screen.getByText(/Current Sequence Status/i)).toBeTruthy());

    await userEvent.click(screen.getByLabelText(/Manual galaxy ID list/i));
    await userEvent.type(screen.getByRole("textbox"), "gal-5\ngal-7");
    await userEvent.click(screen.getByLabelText(/Send email notification to user/i));

    const fileInput = container.querySelector("input[type='file']");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Manual galaxy file input not found");
    }
    await userEvent.upload(fileInput, new File(["gal-8\n"], "append-galaxies.txt", { type: "text/plain" }));

    await userEvent.click(screen.getByRole("button", { name: /Append Sequence \(Manual ID List\)/i }));

    await waitFor(() => expect(manualAssignMutation).toHaveBeenCalledTimes(1));
    expect(manualAssignMutation.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      galaxyExternalIds: ["gal-5", "gal-7", "gal-8"],
    });

    await waitFor(() => expect(updateManualSequenceAssignmentStats).toHaveBeenCalledTimes(1));
    expect(updateManualSequenceAssignmentStats.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      startIndex: 10,
      batchIndex: 0,
    });

    await waitFor(() => expect(sendSequenceExtendedEmail).toHaveBeenCalledTimes(1));
    expect(sendSequenceExtendedEmail.mock.calls[0][0]).toMatchObject({
      targetUserId: "target-user",
      previousSize: 10,
      newSize: 12,
      galaxiesAdded: 2,
      procedureType: "manualList",
    });

    expect(screen.getByText(/Skipped 1 IDs already present/i)).toBeTruthy();
    expect(screen.getByText(/Added 2 galaxies from the supplied list/i)).toBeTruthy();
  });
});