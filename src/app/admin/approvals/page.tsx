import { ActionButtons } from "./actions";

const GROUP_ID = process.env.ALLURA_GROUP_ID ?? "allura-roninmemory";

interface Proposal {
  id: string;
  group_id: string;
  content: string;
  score: number;
  reasoning: string | null;
  tier: string;
  status: string;
  trace_ref: string | null;
  created_at: string;
}

export const dynamic = "force-dynamic";

async function fetchPendingProposals(): Promise<Proposal[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/curator/proposals?group_id=${GROUP_ID}&status=pending`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch proposals: ${res.status}`);
  }
  const data = await res.json();
  return data.proposals;
}

export default async function ApprovalsPage() {
  let proposals: Proposal[];
  let fetchError: string | null = null;

  try {
    proposals = await fetchPendingProposals();
  } catch (err) {
    proposals = [];
    fetchError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div>
      <h1>Curator Approval Queue</h1>
      <p>Group: {GROUP_ID}</p>

      {fetchError && (
        <div>
          <strong>Error loading proposals:</strong> {fetchError}
        </div>
      )}

      {!fetchError && proposals.length === 0 && (
        <p>No pending proposals.</p>
      )}

      {proposals.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>trace_ref</th>
              <th>content</th>
              <th>status</th>
              <th>score</th>
              <th>tier</th>
              <th>created_at</th>
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => (
              <tr key={p.id}>
                <td>{p.trace_ref ?? "—"}</td>
                <td>{p.content}</td>
                <td>{p.status}</td>
                <td>{p.score}</td>
                <td>{p.tier}</td>
                <td>{p.created_at}</td>
                <td>
                  <ActionButtons proposalId={p.id} groupId={p.group_id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}