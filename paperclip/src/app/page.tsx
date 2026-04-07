/**
 * Paperclip Dashboard - Docker Standalone
 * Minimal HITL governance interface
 */

export default function PaperclipDashboard() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🏗️ Paperclip Dashboard</h1>
      <p>Running in Docker container</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Connection Status</h2>
        <ul>
          <li>✅ OpenClaw Gateway: Connected</li>
          <li>✅ PostgreSQL: Connected</li>
          <li>✅ Neo4j: Connected</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>HITL Approvals</h2>
        <p>Pending: 3</p>
        <p>Approved Today: 0</p>
      </div>
    </div>
  );
}
