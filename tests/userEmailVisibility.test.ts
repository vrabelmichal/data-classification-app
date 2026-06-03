import { describe, expect, it } from "vitest";
import {
  obfuscateEmail,
  resolveDisplayNameOrObfuscatedEmail,
  resolveEmailForViewer,
} from "../convex/lib/userEmailVisibility";
import {
  DEFAULT_ROLE_PERMISSIONS as backendDefaultRolePermissions,
  getPermissionsForRole,
  normalizeRolePermissions,
} from "../convex/lib/permissions";
import {
  DEFAULT_ROLE_PERMISSIONS as frontendDefaultRolePermissions,
  cloneRolePermissions,
} from "../src/lib/permissions";

describe("user email visibility helpers", () => {
  it("obfuscates a standard email", () => {
    expect(obfuscateEmail("person@example.com")).toBe("pe***@ex***.com");
  });

  it("keeps very short local/domain parts readable", () => {
    expect(obfuscateEmail("ab@cd.com")).toBe("ab@cd.com");
  });

  it("returns null for empty input", () => {
    expect(obfuscateEmail(null)).toBeNull();
    expect(obfuscateEmail(undefined)).toBeNull();
    expect(obfuscateEmail("   ")).toBeNull();
  });

  it("falls back to trimmed source when email is malformed", () => {
    expect(obfuscateEmail("  not-an-email  ")).toBe("not-an-email");
  });

  it("uses name when available", () => {
    expect(
      resolveDisplayNameOrObfuscatedEmail({
        name: "Alice",
        email: "alice@example.com",
      })
    ).toBe("Alice");
  });

  it("falls back to obfuscated email when name is missing", () => {
    expect(
      resolveDisplayNameOrObfuscatedEmail({
        name: "",
        email: "alice@example.com",
      })
    ).toBe("al***@ex***.com");
  });

  it("returns null display name when name and email are missing", () => {
    expect(
      resolveDisplayNameOrObfuscatedEmail({
        name: null,
        email: null,
      })
    ).toBeNull();
  });

  it("returns raw email when viewer permission allows disclosure", () => {
    expect(
      resolveEmailForViewer({
        name: "Alice",
        email: "alice@example.com",
        canViewRawEmail: true,
      })
    ).toBe("alice@example.com");
  });

  it("returns null email when disclosure is not allowed and name is available", () => {
    expect(
      resolveEmailForViewer({
        name: "Alice",
        email: "alice@example.com",
        canViewRawEmail: false,
      })
    ).toBeNull();
  });

  it("returns obfuscated email when disclosure is not allowed and name is missing", () => {
    expect(
      resolveEmailForViewer({
        name: null,
        email: "alice@example.com",
        canViewRawEmail: false,
      })
    ).toBe("al***@ex***.com");
  });

  it("enforces obfuscated fallback for missing-name identity when disclosure is denied", () => {
    const displayName = resolveDisplayNameOrObfuscatedEmail({
      name: null,
      email: "no.name@example.com",
    });
    const emailForViewer = resolveEmailForViewer({
      name: null,
      email: "no.name@example.com",
      canViewRawEmail: false,
    });

    expect(displayName).toBe("no***@ex***.com");
    expect(emailForViewer).toBe("no***@ex***.com");
  });
});

describe("viewUserEmails role defaults and normalization", () => {
  it("defaults to allowed for admin and analyst, denied for maintainer and user", () => {
    expect(backendDefaultRolePermissions.admin.viewUserEmails).toBe(true);
    expect(backendDefaultRolePermissions.analyst.viewUserEmails).toBe(true);
    expect(backendDefaultRolePermissions.maintainer.viewUserEmails).toBe(false);
    expect(backendDefaultRolePermissions.user.viewUserEmails).toBe(false);

    expect(frontendDefaultRolePermissions.admin.viewUserEmails).toBe(true);
    expect(frontendDefaultRolePermissions.analyst.viewUserEmails).toBe(true);
    expect(frontendDefaultRolePermissions.maintainer.viewUserEmails).toBe(false);
    expect(frontendDefaultRolePermissions.user.viewUserEmails).toBe(false);
  });

  it("keeps admin full access even without explicit rolePermissions payload", () => {
    const permissions = getPermissionsForRole("admin", {});
    expect(permissions.viewUserEmails).toBe(true);
  });

  it("maps legacy viewAssignmentCoverageUserEmails to viewUserEmails on backend", () => {
    const normalized = normalizeRolePermissions({
      maintainer: {
        viewAssignmentCoverageUserEmails: true,
      },
    });

    expect(normalized.maintainer.viewUserEmails).toBe(true);
  });

  it("prefers explicit new key over legacy key when both are present", () => {
    const normalized = normalizeRolePermissions({
      maintainer: {
        viewUserEmails: false,
        viewAssignmentCoverageUserEmails: true,
      },
    });

    expect(normalized.maintainer.viewUserEmails).toBe(false);
  });

  it("maps legacy key on frontend cloneRolePermissions", () => {
    const cloned = cloneRolePermissions({
      maintainer: {
        viewAssignmentCoverageUserEmails: true,
      } as any,
    });

    expect(cloned.maintainer.viewUserEmails).toBe(true);
  });
});
