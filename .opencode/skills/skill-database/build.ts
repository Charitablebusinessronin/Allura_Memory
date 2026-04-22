#!/usr/bin/env bun

console.log('Building Allura Database Skill...');

import { spawn } from 'bun';

// Run TypeScript compilation
const result = await spawn('bun', ['run', 'typecheck'], {
  stdio: 'inherit'
});

if (result.exitCode !== 0) {
  console.error('TypeScript compilation failed');
  process.exit(1);
}

console.log('TypeScript compilation successful');
console.log('Build complete!');
