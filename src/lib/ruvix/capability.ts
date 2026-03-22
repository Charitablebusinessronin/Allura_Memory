import { getRuvixBridge } from "./bridge";

export type CapabilityType =
  | { type: "event_create"; group_id: string }
  | { type: "event_read"; group_id: string }
  | { type: "insight_create"; group_id: string }
  | { type: "insight_promote"; group_id: string }
  | { type: "insight_supersede"; group_id: string }
  | { type: "system_checkpoint" }
  | { type: "system_replay" }
  | { type: "policy_modify" };

export interface CapabilityToken {
  tokenId: string;
  capability: CapabilityType;
  grantedTo: string;
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
  signature: string;
  revoked: boolean;
}

export interface CapabilityGrantRequest {
  capability: CapabilityType;
  grantedTo: string;
  expiresInSecs?: number;
}

export interface CapabilityVerifyRequest {
  tokenId: string;
  requiredCapability: CapabilityType;
}

export async function grantCapability(
  request: CapabilityGrantRequest
): Promise<CapabilityToken> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/capabilities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capability: request.capability,
      granted_to: request.grantedTo,
      expires_in_secs: request.expiresInSecs,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to grant capability: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

export async function revokeCapability(tokenId: string): Promise<boolean> {
  const bridge = getRuvixBridge();
  
  const response = await fetch(
    `http://127.0.0.1:9001/v1/capabilities/${tokenId}/revoke`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to revoke capability: ${response.statusText}`);
  }

  const data = await response.json();
  return data.revoked === true;
}

export async function verifyCapability(
  request: CapabilityVerifyRequest
): Promise<{
  valid: boolean;
  token?: CapabilityToken;
  error?: string;
  expiredAt?: number;
}> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/capabilities/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token_id: request.tokenId,
      required_capability: request.requiredCapability,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to verify capability: ${response.statusText}`);
  }

  return response.json();
}

export async function hasCapability(
  principal: string,
  capability: CapabilityType
): Promise<boolean> {
  const bridge = getRuvixBridge();
  
  const response = await fetch(
    `http://127.0.0.1:9001/v1/capabilities/list?principal=${encodeURIComponent(principal)}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.tokens.some((t: CapabilityToken) => 
    !t.revoked && JSON.stringify(t.capability) === JSON.stringify(capability)
  );
}

export function createEventCreateCapability(groupId: string): CapabilityType {
  return { type: "event_create", group_id: groupId };
}

export function createInsightPromoteCapability(groupId: string): CapabilityType {
  return { type: "insight_promote", group_id: groupId };
}
