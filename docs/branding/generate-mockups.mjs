#!/usr/bin/env node
/**
 * Allura Memory Application Mockup Generator
 * Generates 8 UI mockups using fal.ai Ideogram V3
 * Brand: Allura (Caregiver 50%, Creator 30%, Explorer 20%)
 * Colors: Warm Yellow #FFC300, Deep Blue #0581A7, Warm Green #BDBD0D, Dark Gray #142329
 */

import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_DIR = "/home/ronin704/Projects/Brand maker/clients/allura-memory/generated-images/mockups";
const FAL_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY;

if (!FAL_KEY) {
  console.error("❌ Error: FAL_API_KEY or FAL_KEY environment variable not set");
  console.error("   Set it with: export FAL_API_KEY='your-key-here'");
  process.exit(1);
}

// Configure fal client
fal.config({ credentials: FAL_KEY });

// Brand colors for reference
const BRAND_COLORS = {
  warmYellow: { r: 255, g: 195, b: 0 },      // #FFC300 - Primary
  deepBlue: { r: 5, g: 129, b: 167 },         // #0581A7 - Secondary
  warmGreen: { r: 189, g: 189, b: 13 },      // #BDBD0D - Tertiary
  darkGray: { r: 20, g: 35, b: 41 },          // #142329 - Text
  white: { r: 245, g: 245, b: 245 }           // #F5F5F5 - Background
};

// Mockup definitions with prompts grounded in brand strategy
const MOCKUPS = [
  // DASHBOARD SCREENS (3 variations)
  {
    id: "dashboard-main",
    category: "Dashboard",
    name: "Main Memory Dashboard",
    prompt: `UI/UX design mockup for "allura" memory dashboard web application, warm and connected brand identity, Caregiver archetype aesthetic. Clean interface with soft rounded corners and droplet-shaped UI elements. Primary color: warm golden yellow (#FFC300) accents on white (#F5F5F5) background. Deep teal-blue (#0581A7) for secondary actions. Dashboard shows: memory cards in a grid layout with soft shadows, "Your Memories" header in geometric sans-serif typography, navigation sidebar with rounded icons, search bar with pill shape, warm and inviting empty states. Soft ambient shadows, 3-layer depth system. No photorealistic elements, no photos of people, clean vector UI style. Professional SaaS dashboard aesthetic with human-centered warmth.`,
    image_size: "landscape_16_9",
    style_preset: "MINIMAL_ILLUSTRATION"
  },
  {
    id: "dashboard-timeline",
    category: "Dashboard",
    name: "Memory Timeline View",
    prompt: `UI/UX design mockup for "allura" memory timeline interface, warm community-focused brand. Vertical timeline layout with droplet-shaped nodes connected by flowing curved lines. Color palette: warm yellow (#FFC300) highlights, deep blue (#0581A7) connectors, forest green (#BDBD0D) accents on cream white background. Timeline shows memory entries with rounded cards, date markers, "Your Journey" header. Soft organic curves suggesting water ripples, gentle shadow layers. Clean sans-serif typography (Outfit/Inter style). No photorealistic elements, no stock photos, pure UI mockup. Warm, trustworthy, innovative mood.`,
    image_size: "landscape_16_9",
    style_preset: "MINIMAL_ILLUSTRATION"
  },
  {
    id: "dashboard-search",
    category: "Dashboard",
    name: "Search & Results Screen",
    prompt: `UI/UX design mockup for "allura" memory search interface. Clean search results page with prominent search bar at top, pill-shaped with warm yellow (#FFC300) accent. Results displayed as rounded cards with soft shadows, filter chips in deep blue (#0581A7). White background with subtle warm cream tones. "Find Your Memories" header in bold geometric sans-serif. Tag cloud with rounded pills in various brand colors. Empty state illustration with warm, inviting message. No photorealistic elements, no photos, pure interface design. Caregiver archetype warmth with Creator archetype craft.`,
    image_size: "landscape_16_9",
    style_preset: "MINIMAL_ILLUSTRATION"
  },

  // MOBILE SCREENS (3 variations)
  {
    id: "mobile-home",
    category: "Mobile",
    name: "Mobile Home Screen",
    prompt: `Mobile app UI mockup for "allura" memory app home screen, iPhone frame. Warm and connected brand aesthetic. Bottom navigation with rounded icons, floating action button in warm yellow (#FFC300). Home screen shows: greeting "Good morning" in friendly sans-serif, memory preview cards with rounded corners and soft shadows, "Recent Memories" section with horizontal scroll. Deep blue (#0581A7) accents, cream white background. Droplet-shaped UI elements, soft ambient shadows. No photorealistic content, no photos of people, clean vector UI. Portrait mobile format, professional app design.`,
    image_size: { width: 750, height: 1334 }, // iPhone 8 dimensions
    style_preset: "MINIMAL_ILLUSTRATION"
  },
  {
    id: "mobile-capture",
    category: "Mobile",
    name: "Memory Capture Screen",
    prompt: `Mobile app UI mockup for "allura" memory capture screen, iPhone frame. "Capture a Memory" interface with large rounded capture button in warm yellow (#FFC300). Text input area with soft rounded corners, tag selection with pill-shaped chips in deep blue (#0581A7) and warm green (#BDBD0D). Voice memo button, photo attachment area with placeholder icon. Cream white background, dark gray (#142329) text. Friendly, inviting interface with Caregiver archetype warmth. No photorealistic elements, clean vector UI design. Portrait mobile format.`,
    image_size: { width: 750, height: 1334 },
    style_preset: "MINIMAL_ILLUSTRATION"
  },
  {
    id: "mobile-settings",
    category: "Mobile",
    name: "Settings & Profile Screen",
    prompt: `Mobile app UI mockup for "allura" settings and profile screen, iPhone frame. Profile section with circular avatar placeholder in warm yellow (#FFC300) ring. Settings list with rounded rows, toggle switches in deep blue (#0581A7). "Your Profile" header in geometric sans-serif. Menu items: Account, Notifications, Privacy, Help, Log Out. Cream white background, soft shadows on cards. Clean, organized layout with Caregiver archetype approachability. No photorealistic elements, vector UI only. Portrait mobile format.`,
    image_size: { width: 750, height: 1334 },
    style_preset: "MINIMAL_ILLUSTRATION"
  },

  // MARKETING PAGES (2 variations)
  {
    id: "marketing-landing",
    category: "Marketing",
    name: "Landing Page Hero",
    prompt: `Website landing page hero section design for "allura" - community memory platform. Large headline "Where Memories Come Alive" in bold geometric sans-serif (Outfit style). Subheadline in warm gray. Primary CTA button in warm yellow (#FFC300) with rounded pill shape. Secondary CTA in outline style with deep blue (#0581A7) border. Hero illustration: abstract droplet shapes, connected nodes suggesting community, warm color palette with yellow, blue, green accents on white background. Soft gradient, no photorealistic imagery, clean vector illustration style. Navigation bar with logo placeholder. Warm, inviting, professional SaaS landing page aesthetic.`,
    image_size: "landscape_16_9",
    style_preset: "EDITORIAL"
  },
  {
    id: "marketing-features",
    category: "Marketing",
    name: "Features Page",
    prompt: `Website features page design for "allura" memory platform. "Features That Feel Like Home" header in bold sans-serif. Three feature cards in a row, each with rounded corners, soft shadows, icon placeholder in warm yellow (#FFC300), deep blue (#0581A7), and warm green (#BDBD0D). Feature titles: "Capture Moments", "Connect Stories", "Cherish Forever". Clean icon illustrations, brief descriptions in readable sans-serif. White background with subtle warm cream sections. Professional SaaS marketing page aesthetic, no photorealistic elements, vector graphics only. Warm, trustworthy, innovative mood.`,
    image_size: "landscape_16_9",
    style_preset: "EDITORIAL"
  }
];

// Generation log
const generationLog = {
  timestamp: new Date().toISOString(),
  client: "allura-memory",
  agent: "glaser",
  group_id: "allura-team-durham",
  mockups: []
};

async function generateMockup(mockup, index) {
  console.log(`\n🎨 [${index + 1}/${MOCKUPS.length}] Generating: ${mockup.name}`);
  console.log(`   Category: ${mockup.category}`);
  console.log(`   Style: ${mockup.style_preset}`);

  try {
    const result = await fal.subscribe("fal-ai/ideogram/v3", {
      input: {
        prompt: mockup.prompt,
        style_preset: mockup.style_preset,
        rendering_speed: "QUALITY",
        expand_prompt: true,
        num_images: 1,
        image_size: mockup.image_size,
        negative_prompt: "photorealistic people, stock photos, photography, 3D render, cluttered, messy, cold colors, harsh shadows, sharp angles, corporate sterile",
        color_palette: {
          members: [
            { rgb: BRAND_COLORS.warmYellow, color_weight: 0.35 },
            { rgb: BRAND_COLORS.deepBlue, color_weight: 0.25 },
            { rgb: BRAND_COLORS.warmGreen, color_weight: 0.15 },
            { rgb: BRAND_COLORS.darkGray, color_weight: 0.15 },
            { rgb: BRAND_COLORS.white, color_weight: 0.10 }
          ]
        }
      },
      logs: false,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          process.stdout.write(".");
        }
      },
    });

    console.log(" ✓ Generated");

    // Download image
    const imageUrl = result.data.images[0].url;
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const outputPath = path.join(OUTPUT_DIR, `${mockup.id}.png`);
    await fs.writeFile(outputPath, buffer);
    console.log(`   💾 Saved: ${outputPath}`);

    // Log to generation log
    generationLog.mockups.push({
      id: mockup.id,
      name: mockup.name,
      category: mockup.category,
      prompt: mockup.prompt,
      style_preset: mockup.style_preset,
      request_id: result.requestId,
      image_url: imageUrl,
      seed: result.data.seed,
      output_path: outputPath,
      timestamp: new Date().toISOString(),
      status: "success"
    });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error(`\n❌ Error generating ${mockup.name}:`, error.message);
    generationLog.mockups.push({
      id: mockup.id,
      name: mockup.name,
      category: mockup.category,
      status: "failed",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🎨 ALLURA MEMORY APPLICATION MOCKUP GENERATOR");
  console.log("=".repeat(60));
  console.log(`Client: allura-memory`);
  console.log(`Agent: glaser (Visual Director)`);
  console.log(`Group: allura-team-durham`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log("=".repeat(60));

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Generate all mockups
  for (let i = 0; i < MOCKUPS.length; i++) {
    await generateMockup(MOCKUPS[i], i);
  }

  // Save generation log
  const logPath = path.join(OUTPUT_DIR, "generation-log.json");
  await fs.writeFile(logPath, JSON.stringify(generationLog, null, 2));
  console.log(`\n📝 Generation log saved: ${logPath}`);

  // Summary
  const successful = generationLog.mockups.filter(m => m.status === "success").length;
  const failed = generationLog.mockups.filter(m => m.status === "failed").length;

  console.log("\n" + "=".repeat(60));
  console.log("📊 GENERATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Successful: ${successful}/${MOCKUPS.length}`);
  console.log(`❌ Failed: ${failed}/${MOCKUPS.length}`);
  console.log("\nGenerated Files:");
  generationLog.mockups.forEach(m => {
    const icon = m.status === "success" ? "✓" : "✗";
    console.log(`  ${icon} ${m.id}.png - ${m.name}`);
  });
  console.log("=".repeat(60));
}

main().catch(console.error);
