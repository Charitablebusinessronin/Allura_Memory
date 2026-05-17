import { z } from "zod";

const PermissionProfileActorSchema = z.enum(["human", "service", "agent"]);

export const PermissionProfileSchema = z.object({
  id: z.string().min(1),
  group_id: z.string().regex(/^allura-/),
  name: z.string().min(1),
  description: z.string().min(1),
  role_ids: z.array(z.string().min(1)),
  allowed_actions: z.array(z.string().min(1)),
  memory_scope: z.array(z.string().min(1)),
  applies_to: z.array(PermissionProfileActorSchema),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export const PermissionProfileRequestBodySchema = PermissionProfileSchema.pick({
  name: true,
  description: true,
  role_ids: true,
  allowed_actions: true,
  memory_scope: true,
  applies_to: true,
}).partial();

export type PermissionProfile = z.infer<typeof PermissionProfileSchema>;
export type PermissionProfileRequestBody = z.infer<typeof PermissionProfileRequestBodySchema>;

export type PermissionProfileValidation =
  | { ok: true; data: PermissionProfile; errors: [] }
  | { ok: false; data: null; errors: string[] };

export function validatePermissionProfile(profile: unknown): PermissionProfileValidation {
  const parsed = PermissionProfileSchema.safeParse(profile);

  if (parsed.success) {
    return { ok: true, data: parsed.data, errors: [] };
  }

  return {
    ok: false,
    data: null,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

export function updatePermissionProfile(
  profile: PermissionProfile,
  updates: Partial<PermissionProfileRequestBody>,
): PermissionProfile {
  return {
    ...profile,
    ...updates,
    id: profile.id,
    group_id: profile.group_id,
    created_at: profile.created_at,
    updated_at: new Date().toISOString(),
  };
}
