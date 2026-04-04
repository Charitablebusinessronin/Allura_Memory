import { parseSkillFile, findSkillFiles, ParsedSkill } from './parse-skill-files';
import { createNotionPage, DATABASE_IDS, SkillSchema } from './notion-client';
import { transformSkillToNotion } from './transform-to-notion';

interface HydrationResult {
  totalSkills: number;
  created: number;
  errors: Array<{ skill: string; error: string }>;
}

export async function hydrateSkills(baseDir: string): Promise<HydrationResult> {
  console.log('Finding skill files...');
  const skillFiles = findSkillFiles(baseDir);

  if (skillFiles.length === 0) {
    console.log('No skill files found');
    return { totalSkills: 0, created: 0, errors: [] };
  }

  console.log(`Found ${skillFiles.length} skill file(s)`);

  const result: HydrationResult = {
    totalSkills: skillFiles.length,
    created: 0,
    errors: [],
  };

  const byCategory: Record<string, string[]> = {};

  for (const skillFile of skillFiles) {
    try {
      console.log(`Processing ${skillFile}...`);

      const parsed = parseSkillFile(skillFile);

      if (!byCategory[parsed.category]) {
        byCategory[parsed.category] = [];
      }
      byCategory[parsed.category].push(parsed.name);

      console.log(`Name: ${parsed.name}`);
      console.log(`Category: ${parsed.category}`);
      console.log(`Description: ${parsed.description.substring(0, 50)}...`);

      const skillProps = transformSkillToNotion({
        name: parsed.name,
        description: parsed.description,
        category: parsed.category,
        status: parsed.status,
        filePath: parsed.filePath,
        requiredTools: [],
        usageCount: 0,
      });

      const pageId = await createNotionPage(DATABASE_IDS.skills, skillProps);

      console.log(`Created skill: ${parsed.name}`);
      result.created++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error creating skill: ${errorMsg}`);
      result.errors.push({
        skill: skillFile,
        error: errorMsg,
      });
    }
  }

  console.log('Hydration Summary:');
  console.log(`Total skills: ${result.totalSkills}`);
  console.log(`Created: ${result.created}`);
  console.log(`Errors: ${result.errors.length}`);

  console.log('By Category:');
  for (const [category, skills] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${skills.length} skills`);
    skills.forEach(skill => console.log(`    - ${skill}`));
  }

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach(({ skill, error }) => {
      console.log(`  ${skill}: ${error}`);
    });
  }

  return result;
}

if (import.meta.main) {
  const baseDir = process.cwd();
  hydrateSkills(baseDir)
    .then((result) => {
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
