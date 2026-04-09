/**
 * Next.js Instrumentation
 * 
 * Initializes the RuVix kernel on server startup.
 * This runs once when the Next.js server starts, before handling any requests.
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

import { RuVixKernel } from "@/kernel/ruvix";

/**
 * Register function called once on server startup
 */
export async function register() {
  console.log("[RuVix Kernel] Starting initialization...");
  
  try {
    // Initialize the kernel
    const status = RuVixKernel.initializeKernel();
    
    if (status.initialized) {
      console.log(`[RuVix Kernel] ✅ Initialized successfully`);
      console.log(`[RuVix Kernel] Version: ${status.version}`);
      console.log(`[RuVix Kernel] Syscalls: ${status.syscalls.length} available`);
      console.log(`[RuVix Kernel] Policies: ${status.policies} registered`);
    } else {
      console.error("[RuVix Kernel] ❌ Initialization failed:");
      status.errors.forEach(error => console.error(`  - ${error}`));
      
      // In production, you might want to throw here to prevent startup
      // For now, we log but continue (graceful degradation)
      if (process.env.NODE_ENV === "production") {
        throw new Error(`RuVix kernel initialization failed: ${status.errors.join("; ")}`);
      }
    }
  } catch (error) {
    console.error("[RuVix Kernel] ❌ Unexpected error during initialization:", error);
    
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

/**
 * On-demand handler called when using `next start`
 * Not used in development (`next dev`)
 */
export async function onRequest() {
  // This is called per-request in some edge cases
  // Kernel should already be initialized from register()
  // No-op here as register() handles the one-time init
}
