/**
 * Promotion Proposal Types Tests
 * Story 3-2: Task 1 - Create Promotion Proposal Entity
 */

import { describe, it, expect } from 'vitest';
import { VALID_PROPOSAL_TRANSITIONS, ProposalStatus } from './types';

describe('Promotion Proposal Types', () => {
  describe('VALID_PROPOSAL_TRANSITIONS', () => {
    it('should allow draft → pending transition', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['draft']).toContain('pending');
    });

    it('should allow pending → approved transition', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['pending']).toContain('approved');
    });

    it('should allow pending → rejected transition', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['pending']).toContain('rejected');
    });

    it('should allow approved → superseded transition', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['approved']).toContain('superseded');
    });

    it('should allow approved → revoked transition', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['approved']).toContain('revoked');
    });

    it('should NOT allow rejected → approved direct transition', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['rejected']).not.toContain('approved');
    });

    it('should allow rejected → draft for resubmission', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['rejected']).toContain('draft');
    });

    it('should have terminal states with no transitions', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['superseded']).toEqual([]);
      expect(VALID_PROPOSAL_TRANSITIONS['revoked']).toEqual([]);
    });

    it('should allow pending → draft for withdrawal', () => {
      expect(VALID_PROPOSAL_TRANSITIONS['pending']).toContain('draft');
    });
  });

  describe('Type definitions', () => {
    it('should have correct ProposalStatus type', () => {
      const validStatuses: ProposalStatus[] = [
        'draft',
        'pending',
        'approved',
        'rejected',
        'superseded',
        'revoked',
      ];
      
      expect(validStatuses).toHaveLength(6);
    });
  });
});