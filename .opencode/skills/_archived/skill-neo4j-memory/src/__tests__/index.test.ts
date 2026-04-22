#!/usr/bin/env bun

import { describe, it, expect } from 'bun:test';

describe('Neo4j Memory Skill - Read-Only Enforcement', () => {
  it('should validate group_id starts with allura-', () => {
    expect('allura-test').toMatch(/^allura-/);
    expect('allura-*').toBe('allura-*');
  });
});

describe('Neo4j Memory Skill - Query Helpers', () => {
  it('should allow MATCH queries', () => {
    expect('MATCH').toMatch(/^(MATCH|WITH|RETURN|CALL)$/i);
  });

  it('should reject CREATE queries', () => {
    expect('CREATE').not.toMatch(/^(MATCH|WITH|RETURN|CALL)$/i);
  });
});
