/**
 * Next.js Configuration
 * 
 * Enables experimental features and instrumentation for RuVix kernel.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable instrumentation (RuVix kernel initialization)
  experimental: {
    instrumentationHook: true,
  },
  
  // Other Next.js config
  reactStrictMode: true,
  
  // Ensure server-side code can access kernel
  serverRuntimeConfig: {
    // Will be available on server only
    ruVixKernelEnabled: true,
  },
};

module.exports = nextConfig;
