import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAction, useQuery, type ReactAction } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../convex/_generated/api";
import { StatisticsTab } from "../src/components/statistics/StatisticsTab";

vi.mock("convex/react", () => ({
  useAction: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    users: {
      getUserProfile: "getUserProfile",
      getUsersForSelection: "getUsersForSelection",
      getUserStats: "getUserStats",
      refreshUserStatsSnapshot: "refreshUserStatsSnapshot",
    },
    classification: {
      getProgress: "getProgress",
    },
    system_settings: {
      getPublicSystemSettings: "getPublicSystemSettings",
    },
  },
}));

const useQueryMock = vi.mocked(useQuery);
const useActionMock = vi.mocked(useAction);

function toActionMock<Action extends FunctionReference<"action">>(
  mockFn: ReturnType<typeof vi.fn>
): ReactAction<Action> {
  return mockFn as unknown as ReactAction<Action>;
}

describe("StatisticsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows blacklist-aware sequence counts in a separate section", () => {
    const userProfile = {
      userId: "user-1",
      role: "user",
      permissions: {
        viewUserStatistics: false,
      },
    };
    const systemSettings = {
      showAwesomeFlag: true,
      showValidRedshift: true,
      showVisibleNucleus: true,
      failedFittingMode: "checkbox",
    };
    const userStats = {
      data: {
        total: 42,
        thisWeek: 5,
        byLsbClass: {
          nonLSB: 30,
          LSB: 12,
        },
        byMorphology: {
          featureless: 10,
          irregular: 8,
          spiral: 14,
          elliptical: 10,
        },
        averageTime: 17,
        awesomeCount: 3,
        validRedshiftCount: 4,
        visibleNucleusCount: 5,
        failedFittingCount: 1,
        _source: "cache" as const,
      },
      cache: {
        status: "cached" as const,
        updatedAt: Date.now(),
        dirtySince: null,
      },
    };
    const progress = {
      classified: 9,
      skipped: 1,
      total: 15,
      completed: 10,
      remaining: 5,
      percentage: 67,
      effectiveClassified: 7,
      effectiveSkipped: 1,
      effectiveTotal: 10,
      effectiveCompleted: 8,
      effectiveRemaining: 2,
      effectivePercentage: 80,
      blacklistedTotal: 5,
      blacklistedClassifiedCount: 2,
      blacklistedSkippedCount: 0,
    };

    useQueryMock.mockImplementation((reference) => {
      switch (reference) {
        case api.users.getUserProfile:
          return userProfile;
        case api.system_settings.getPublicSystemSettings:
          return systemSettings;
        case api.users.getUserStats:
          return userStats;
        case api.classification.getProgress:
          return progress;
        default:
          return undefined;
      }
    });

    useActionMock.mockReturnValue(toActionMock(vi.fn()));

    render(<StatisticsTab />);

    const heading = screen.getByText("Blacklisted galaxies in your sequence");
    const section = heading.closest(".rounded-lg");

    expect(section?.textContent).toContain("In sequence");
    expect(section?.textContent).toContain("Classified");
    expect(section?.textContent).toContain("5");
    expect(section?.textContent).toContain("2");
    expect(screen.getByText("80%")).toBeTruthy();
  });
});