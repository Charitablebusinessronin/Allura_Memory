/**
 * Approval Queue Utilities Tests
 * Story 3-1: Task 1 - Connect to Real Data
 * 
 * Tests for server-side data fetching utilities
 */

import { describe, it, expect } from 'vitest';
import { getGroupIdFromHeaders } from './approval-utils';

describe('Approval Utilities', () => {
  describe('getGroupIdFromHeaders', () => {
    it('should return valid group_id from headers', () => {
      const mockHeaders = new Headers({
        'x-group-id': 'allura-faith-meats'
      });
      
      const result = getGroupIdFromHeaders(mockHeaders);
      expect(result).toBe('allura-faith-meats');
    });

    it('should throw error when group_id is missing', () => {
      const mockHeaders = new Headers({});
      
      expect(() => getGroupIdFromHeaders(mockHeaders)).toThrow('group_id is required');
    });

    it('should throw error when group_id format is invalid', () => {
      const mockHeaders = new Headers({
        'x-group-id': '-invalid-format' // Starts with hyphen (invalid)
      });
      
      expect(() => getGroupIdFromHeaders(mockHeaders)).toThrow();
    });

    it('should accept allura format without error', () => {
      const mockHeaders = new Headers({
        'x-group-id': 'allura-faith-meats'
      });
      
      const result = getGroupIdFromHeaders(mockHeaders);
      expect(result).toBe('allura-faith-meats');
    });
  });
});