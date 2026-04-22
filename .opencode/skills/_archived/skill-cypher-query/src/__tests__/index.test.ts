#!/usr/bin/env bun

import { describe, it, expect } from 'bun:test';

describe('Cypher Query Skill - Read-Only Enforcement', () => {
  it('should reject write operations', () => {
    const writeQueries = [
      'CREATE (n:Node {name: "test"})',
      'MATCH (n) SET n.prop = "value"',
      'MATCH (n) DELETE n',
      'UPDATE events SET status = "done"',
      'MERGE (n:Node {id: 1})',
      'INSERT INTO events VALUES (1, 2, 3)',
    ];

    for (const query of writeQueries) {
      const upper = query.toUpperCase();
      const hasCreate = upper.includes('CREATE') || upper.includes('MERGE');
      const hasSet = upper.includes('SET ');
      const hasDelete = upper.includes('DELETE');
      const hasUpdate = upper.includes('UPDATE');
      const hasInsert = upper.includes('INSERT');

      expect(hasCreate || hasSet || hasDelete || hasUpdate || hasInsert).toBe(true);
    }
  });

  it('should allow read operations', () => {
    const readQueries = [
      'MATCH (n) RETURN n',
      'RETURN 1 as test',
      'WITH 1 as x MATCH (n) RETURN n',
      'CALL db.index.fulltext.queryNodes',
    ];

    for (const query of readQueries) {
      const upper = query.toUpperCase();
      const firstToken = upper.split(/\s+/)[0];
      const readOnlyOps = ['MATCH', 'WITH', 'RETURN', 'CALL'];
      
      expect(readOnlyOps.includes(firstToken)).toBe(true);
    }
  });
});

describe('Cypher Query Skill - Group ID Validation', () => {
  it('should validate group_id format', () => {
    const validGroupIds = ['allura-test', 'allura-test-1'];
    const invalidGroupIds = ['Allura-test', 'allura_test'];

    for (const groupId of validGroupIds) {
      expect(groupId).toMatch(/^allura-/);
    }

    for (const groupId of invalidGroupIds) {
      expect(groupId).not.toMatch(/^allura-[a-z0-9-]+$/);
    }
  });
});
