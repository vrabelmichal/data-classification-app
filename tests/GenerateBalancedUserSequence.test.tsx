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
import { GenerateBalancedUserSequence } from "../src/components/admin/GenerateBalancedUserSequence";

vi.mock("convex/react", () => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    galaxies: {
      sequence: {
        getUsersWithoutSequences: "getUsersWithoutSequences",
        getUsersWithSequences: "getUsersWithSequences",
      },
    },
    updateUserSequence: {
      assignGalaxyIdsToSequence: "assignGalaxyIdsToSequence",
      updateManualSequenceAssignmentStats: "updateManualSequenceAssignmentStats",
    },
    generateBalancedUserSequence: {
      generateBalancedUserSequence: "generateBalancedUserSequence",
      updateGalaxyAssignmentStats: "updateGalaxyAssignmentStats",
      sendSequenceGeneratedEmail: "sendSequenceGeneratedEmail",
      cancelSequenceGeneration: "cancelSequenceGeneration",
      rollbackSequence: "rollbackSequence",
      getSequenceGenerationJob: "getSequenceGenerationJob",
    },
    classificationBasedAssignment: {
      generateClassificationBasedUserSequence: "generateClassificationBasedUserSequence",
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

function configureGenerateHooks(options?: {
  usersWithoutSequences?: any[];
  usersWithSequences?: any[];
  jobStatus?: any;
  balancedAction?: ReturnType<typeof vi.fn>;
  classificationAction?: ReturnType<typeof vi.fn>;
  manualAssignMutation?: ReturnType<typeof vi.fn>;
  manualStatsMutation?: ReturnType<typeof vi.fn>;
  sendEmailAction?: ReturnType<typeof vi.fn>;
}) {
  const updateStats = vi.fn();
  const manualAssignMutation = options?.manualAssignMutation ?? vi.fn();
  const manualStatsMutation = options?.manualStatsMutation ?? vi.fn().mockResolvedValue({
    success: true,
    totalProcessed: 2,
    isComplete: true,
  });
  const cancelGeneration = vi.fn();
  const rollbackSequence = vi.fn();
  const balancedAction = options?.balancedAction ?? vi.fn();
  const classificationAction = options?.classificationAction ?? vi.fn();
  const sendEmailAction = options?.sendEmailAction ?? vi.fn().mockResolvedValue({ success: true, to: "test@example.com" });

  useQueryMock.mockImplementation((...hookArgs) => {
    const [reference, args] = hookArgs;
    if (args === "skip") {
      return undefined;
    }
    switch (reference) {
      case api.galaxies.sequence.getUsersWithoutSequences:
        return options?.usersWithoutSequences ?? [];
      case api.galaxies.sequence.getUsersWithSequences:
        return options?.usersWithSequences ?? [];
      case api.generateBalancedUserSequence.getSequenceGenerationJob:
        return options?.jobStatus;
      default:
        return undefined;
    }
  });

  useMutationMock.mockImplementation((reference) => {
    switch (reference) {
      case api.updateUserSequence.assignGalaxyIdsToSequence:
        return toMutationMock(manualAssignMutation);
      case api.updateUserSequence.updateManualSequenceAssignmentStats:
        return toMutationMock(manualStatsMutation);
      case api.generateBalancedUserSequence.updateGalaxyAssignmentStats:
        return toMutationMock(updateStats);
      case api.generateBalancedUserSequence.cancelSequenceGeneration:
        return toMutationMock(cancelGeneration);
      case api.generateBalancedUserSequence.rollbackSequence:
        return toMutationMock(rollbackSequence);
      default:
        return toMutationMock(vi.fn());
    }
  });

  useActionMock.mockImplementation((reference) => {
    switch (reference) {
      case api.generateBalancedUserSequence.generateBalancedUserSequence:
        return toActionMock(balancedAction);
      case api.classificationBasedAssignment.generateClassificationBasedUserSequence:
        return toActionMock(classificationAction);
      case api.generateBalancedUserSequence.sendSequenceGeneratedEmail:
        return toActionMock(sendEmailAction);
      default:
        return toActionMock(vi.fn());
    }
  });

  return {
    updateStats,
    manualAssignMutation,
    manualStatsMutation,
    cancelGeneration,
    rollbackSequence,
    balancedAction,
    classificationAction,
    sendEmailAction,
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

describe("GenerateBalancedUserSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("prefills expected users with the greater of 10 and the total user count", () => {
    configureGenerateHooks({
      usersWithoutSequences: [
        { userId: "user-a", user: { name: "User A", email: "a@example.com" } },
      ],
    });

    render(
      <GenerateBalancedUserSequence
        users={Array.from({ length: 14 }, (_, index) => ({ userId: `user-${index}` }))}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    expect(getNumberInputByLabelText(/Expected Users \(N\)/i).value).toBe("14");
  });

  it("prefills expected users to 10 when the total user count is lower", () => {
    configureGenerateHooks({
      usersWithoutSequences: [
        { userId: "user-a", user: { name: "User A", email: "a@example.com" } },
      ],
    });

    render(
      <GenerateBalancedUserSequence
        users={Array.from({ length: 5 }, (_, index) => ({ userId: `user-${index}` }))}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    expect(getNumberInputByLabelText(/Expected Users \(N\)/i).value).toBe("10");
  });

  it("shows the balanced procedure by default and preserves regular form values across toggles", async () => {
    configureGenerateHooks({
      usersWithoutSequences: [
        { userId: "user-a", user: { name: "User A", email: "a@example.com" } },
      ],
    });

    render(
      <GenerateBalancedUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    expect(screen.queryByText(/^Target Classification Count$/i)).toBeNull();

    const expectedUsersInput = getNumberInputByLabelText(/Expected Users \(N\)/i);
    const minAssignmentsInput = getNumberInputByLabelText(/Min Assignments Per Entry \(K\)/i);

    await userEvent.clear(expectedUsersInput);
    await userEvent.type(expectedUsersInput, "12");
    await userEvent.clear(minAssignmentsInput);
    await userEvent.type(minAssignmentsInput, "5");

    await userEvent.click(screen.getByLabelText(/Classification-based assignment/i));
    expect(screen.getByText(/^Target Classification Count$/i)).toBeTruthy();

    await userEvent.click(screen.getByLabelText(/Regular balanced assignment/i));
    expect(screen.queryByText(/^Target Classification Count$/i)).toBeNull();
    expect(expectedUsersInput.value).toBe("12");
    expect(minAssignmentsInput.value).toBe("5");
  });

  it("passes uploaded blacklists, excluded sequences, and batch carry-forward exclusions to classification-based generation", async () => {
    const classificationAction = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        requested: 50,
        generated: 2,
        selectedGalaxyIds: ["gal-1", "gal-2"],
      })
      .mockResolvedValueOnce({
        success: true,
        requested: 50,
        generated: 1,
        selectedGalaxyIds: ["gal-3"],
      });
    const sendEmailAction = vi.fn().mockResolvedValue({ success: true, to: "target@example.com" });

    configureGenerateHooks({
      usersWithoutSequences: [
        { userId: "user-a", user: { name: "User A", email: "a@example.com" } },
        { userId: "user-b", user: { name: "User B", email: "b@example.com" } },
      ],
      usersWithSequences: [
        {
          userId: "existing-sequence-user",
          user: { name: "Existing User", email: "existing@example.com" },
          sequenceInfo: { galaxyCount: 3, numClassified: 0 },
        },
      ],
      classificationAction,
      sendEmailAction,
    });

    const { container } = render(
      <GenerateBalancedUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await userEvent.click(screen.getByLabelText(/Classification-based assignment/i));
    await userEvent.click(screen.getByLabelText(/Batch mode/i));
    await userEvent.click(screen.getByLabelText(/Allow Over-Assign/i));
    await userEvent.click(screen.getByLabelText(/User A \(user-a\)/i));
    await userEvent.click(screen.getByLabelText(/User B \(user-b\)/i));
    await userEvent.click(screen.getByLabelText(/Existing User \(3 galaxies\)/i));
    await userEvent.click(screen.getByLabelText(/Send email notification to user/i));

    const fileInput = container.querySelector("input[type='file']");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Blacklist file input not found");
    }
    const file = new File(["gal-x\ngal-y\n gal-y \n"], "blacklist.txt", { type: "text/plain" });
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /Generate Sequences \(Batch\)/i }));

    await waitFor(() => expect(classificationAction).toHaveBeenCalledTimes(2));
    expect(classificationAction.mock.calls[0][0]).toMatchObject({
      targetUserId: "user-a",
      allowOverAssign: true,
      additionalBlacklistedIds: ["gal-x", "gal-y"],
      excludedSequenceUserIds: ["existing-sequence-user"],
    });
    expect(classificationAction.mock.calls[1][0]).toMatchObject({
      targetUserId: "user-b",
      allowOverAssign: true,
      excludedSequenceUserIds: ["existing-sequence-user"],
    });
    expect(classificationAction.mock.calls[1][0].additionalBlacklistedIds).toEqual(
      expect.arrayContaining(["gal-x", "gal-y", "gal-1", "gal-2"])
    );

    await waitFor(() => expect(sendEmailAction).toHaveBeenCalledTimes(2));
    for (const [payload] of sendEmailAction.mock.calls) {
      expect(payload.procedureType).toBe("classificationBased");
    }
  });

  it("forwards dry-run classification-based generation and logs only the first five preview galaxies", async () => {
    const classificationAction = vi.fn().mockResolvedValue({
      success: true,
      requested: 50,
      generated: 6,
      selectedGalaxyIds: ["gal-1", "gal-2", "gal-3", "gal-4", "gal-5", "gal-6"],
    });
    const sendEmailAction = vi.fn().mockResolvedValue({ success: true, to: "target@example.com" });

    configureGenerateHooks({
      usersWithoutSequences: [
        { userId: "user-a", user: { name: "User A", email: "a@example.com" } },
      ],
      classificationAction,
      sendEmailAction,
    });

    render(
      <GenerateBalancedUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await userEvent.click(screen.getByLabelText(/Classification-based assignment/i));
    await userEvent.selectOptions(screen.getByRole("combobox"), "user-a");
    await userEvent.click(screen.getByLabelText(/Send email notification to user/i));
    await userEvent.click(screen.getByLabelText(/Dry run only/i));
    await userEvent.click(screen.getByRole("button", { name: /Dry Run Classification-Based Sequence/i }));

    await waitFor(() => expect(classificationAction).toHaveBeenCalledTimes(1));
    expect(classificationAction.mock.calls[0][0]).toMatchObject({
      targetUserId: "user-a",
      dryRun: true,
    });

    expect(sendEmailAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Showing first 5 of 6 galaxies that would be assigned/i)).toBeTruthy();
    expect(screen.getByText(/Dry-run preview galaxies: gal-1, gal-2, gal-3, gal-4, gal-5/i)).toBeTruthy();
    expect(screen.queryByText(/gal-6/i)).toBeNull();
  });

  it("submits manual galaxy IDs through the integrated third assignment procedure", async () => {
    const manualAssignMutation = vi.fn().mockResolvedValue({
      success: true,
      createdSequence: true,
      uniqueRequestedCount: 4,
      previousSize: 0,
      newSequenceSize: 4,
      addedCount: 4,
      statsStartIndex: 0,
      statsBatchesNeeded: 1,
      statsBatchSize: 500,
      selectedGalaxyIdsPreview: ["gal-1", "gal-2", "gal-3", "gal-4"],
      selectedGalaxyIdsCount: 4,
    });
    const sendEmailAction = vi.fn().mockResolvedValue({ success: true, to: "target@example.com" });

    configureGenerateHooks({
      usersWithoutSequences: [
        { userId: "user-a", user: { name: "User A", email: "a@example.com" } },
      ],
      manualAssignMutation,
      sendEmailAction,
    });

    const { container } = render(
      <GenerateBalancedUserSequence
        users={[]}
        systemSettings={{ availablePapers: ["paper-a", "paper-b"] }}
      />
    );

    await userEvent.click(screen.getByLabelText(/Manual galaxy ID list/i));
    await userEvent.selectOptions(screen.getByRole("combobox"), "user-a");
    await userEvent.type(screen.getByRole("textbox"), "gal-1\ngal-2");
    await userEvent.click(screen.getByLabelText(/Send email notification to user/i));

    const fileInput = container.querySelector("input[type='file']");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Manual galaxy file input not found");
    }
    await userEvent.upload(fileInput, new File(["gal-3\ngal-4\n"], "manual-galaxies.txt", { type: "text/plain" }));

    await userEvent.click(screen.getByRole("button", { name: /Generate Sequence \(Manual ID List\)/i }));

    await waitFor(() => expect(manualAssignMutation).toHaveBeenCalledTimes(1));
    expect(manualAssignMutation.mock.calls[0][0]).toMatchObject({
      targetUserId: "user-a",
      galaxyExternalIds: ["gal-1", "gal-2", "gal-3", "gal-4"],
    });

    await waitFor(() => expect(sendEmailAction).toHaveBeenCalledTimes(1));
    expect(sendEmailAction.mock.calls[0][0]).toMatchObject({
      targetUserId: "user-a",
      generated: 4,
      requested: 4,
      procedureType: "manualList",
    });

    expect(screen.getByText(/Created a sequence with 4 galaxies from the supplied list/i)).toBeTruthy();
  });
});