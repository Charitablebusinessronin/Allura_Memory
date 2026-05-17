import { describe, expect, it } from "vitest";

import {
  PermissionProfileRequestBodySchema,
  updatePermissionProfile,
  validatePermissionProfile,
  type PermissionProfile,
} from "@/lib/auth";

describe("permission profile contract", () => {
  const profile: PermissionProfile = {
    id: "profile_admin",
    group_id: "allura-system",
    name: "Administrator",
    description: "Can manage governed settings.",
    role_ids: ["admin"],
    allowed_actions: ["role:assign"],
    memory_scope: ["allura:audit"],
    applies_to: ["human"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  it("validates and updates mutable permission profile fields", () => {
    const parsed = PermissionProfileRequestBodySchema.parse({
      name: "Admin",
      allowed_actions: ["audit:read"],
    });

    const updated = updatePermissionProfile(profile, parsed);
    const validation = validatePermissionProfile(updated);

    expect(validation.ok).toBe(true);
    expect(validation.data?.name).toBe("Admin");
    expect(validation.data?.allowed_actions).toEqual(["audit:read"]);
    expect(validation.data?.id).toBe(profile.id);
    expect(validation.data?.created_at).toBe(profile.created_at);
  });
});
