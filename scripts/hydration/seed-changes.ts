import { createNotionPage, DATABASE_IDS } from './notion-client';
import { transformChangeToNotion } from './transform-to-notion';

const ADR_001_DATA = {
  name: 'ADR-001: Requirements Traceability Matrix Architecture',
  status: 'Pending Approval' as const,
  changeType: 'Policy Change' as const,
  riskLevel: 'High' as const,
  source: 'Human Input' as const,
  summary: 'Implement a three-tier Requirements Traceability Matrix (RTM) to maintain conceptual integrity across the Agent-OS architecture, ensuring every agent action can be traced back to its business goal ancestry. This ADR establishes B-Tier (Business Goals), F-Tier (Functional Requirements), and Component Mapping layers with AEGIS quality gates for high-stakes decisions.',
  affectedComponents: ['agent', 'skill', 'policy', 'knowledge'],
  aerReference: '9830faf7-9a23-446d-8ee4-1e175c132576',
};

export async function seedAdr001(): Promise<string> {
  console.log('Seeding ADR-001 into Changes queue...\n');

  console.log('ADR-001 Details:');
  console.log(`Name: ${ADR_001_DATA.name}`);
  console.log(`Status: ${ADR_001_DATA.status}`);
  console.log(`Type: ${ADR_001_DATA.changeType}`);
  console.log(`Risk: ${ADR_001_DATA.riskLevel}`);
  console.log(`Source: ${ADR_001_DATA.source}`);
  console.log(`AER: ${ADR_001_DATA.aerReference}`);
  console.log(`Components: ${ADR_001_DATA.affectedComponents.join(', ')}`);

  const changeProps = transformChangeToNotion({
    ...ADR_001_DATA,
    projectId: '3381d9be-65b3-814d-a97e-c7edaf5722f0',
  });

  try {
    const pageId = await createNotionPage(DATABASE_IDS.changes, changeProps);

    console.log(`Created change entry: ${pageId}`);
    console.log('Next Steps:');
    console.log('1. Open Notion to view the Change entry');
    console.log('2. Review ADR-001 details');
    console.log('3. Run the HITL approval script to approve');

    return pageId;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error creating change entry:', errorMsg);
    throw error;
  }
}

if (import.meta.main) {
  seedAdr001()
    .then(() => {
      console.log('Done! Change entry created successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
