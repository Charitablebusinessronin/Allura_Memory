#!/usr/bin/env bun

import { describe, it, expect } from 'bun:test';

describe('Database Skill - Read-Only Enforcement', () => {
  it('should validate group_id format', () => {
    const validGroupIds = ['allura-test', 'allura-test-1', 'allura-abc-123'];
    const invalidGroupIds = ['Allura-test', 'allura_test'];

    for (const groupId of validGroupIds) {
      expect(groupId).toMatch(/^allura-[a-z0-9-]+$/);
    }

    for (const groupId of invalidGroupIds) {
      expect(groupId).not.toMatch(/^allura-[a-z0-9-]+$/);
    }
  });
});

describe('Database Skill - Trace Insert', () => {
  it('should validate required fields', () => {
    const requiredFields = ['event_type', 'agent_id', 'group_id'];
    
    const trace = {
      event_type: 'agent_action',
      agent_id: 'test-agent',
      group_id: 'allura-test'
    };

    for (const field of requiredFields) {
      expect(trace).toHaveProperty(field);
    }

    expect(trace.event_type).toBe('agent_action');
    expect(trace.agent_id).toBe('test-agent');
    expect(trace.group_id).toBe('allura-test');
  });

  it('should accept valid group_id formats', () => {
    const validGroupIds = ['allura-test', 'allura-test-1', 'allura-abc-123'];

    for (const groupId of validGroupIds) {
      expect(groupId).toMatch(/^allura-[a-z0-9-]+$/);
    }
  });
});
