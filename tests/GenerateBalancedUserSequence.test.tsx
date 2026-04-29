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
  sendEmailAction?: ReturnType<typeof vi.fn>;
}) {
  const updateStats = vi.fn();
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
});