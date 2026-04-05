/**
 * Tests for Encoding Validator
 */

import { describe, it, expect } from 'vitest';
import { EncodingValidator, createEncodingValidator } from './encoding-validator.js';

describe('EncodingValidator', () => {
  const validator = createEncodingValidator();

  describe('validateUtf8File', () => {
    it('should validate clean UTF-8 content', () => {
      const content = '# Test File\n\nThis is a valid UTF-8 file.\nNo issues here.';
      const result = validator.validateUtf8File('test.md', content);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect BOM at start of file', () => {
      const content = '\uFEFF# Test File\n\nThis file has a BOM.';
      const result = validator.validateUtf8File('test.md', content);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('BOM detected');
    });

    it('should detect null bytes', () => {
      const content = 'Valid content\0But has null byte';
      const result = validator.validateUtf8File('test.md', content);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Null byte detected');
    });

    it('should detect control characters', () => {
      const content = 'Valid content\x07But has control char';
      const result = validator.validateUtf8File('test.md', content);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Control character');
    });

    it('should allow valid control characters (newline, tab, return)', () => {
      const content = 'Line 1\nLine 2\tIndented\r\nLine 3';
      const result = validator.validateUtf8File('test.md', content);

      expect(result.valid).toBe(true);
    });

    it('should handle emoji and unicode characters', () => {
      const content = '# Test 🎉\n\nUnicode: 你好世界\nEmoji: ✅ ✓';
      const result = validator.validateUtf8File('test.md', content);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateYamlStructure', () => {
    it('should validate clean YAML', () => {
      const content = 'key: value\nnested:\n  item: value';
      const result = validator.validateYamlStructure(content, 'test.yaml');

      expect(result.valid).toBe(true);
    });

    it('should detect tabs in YAML', () => {
      const content = 'key: value\n\tnested: value';
      const result = validator.validateYamlStructure(content, 'test.yaml');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tab character detected');
    });

    it('should allow comments with trailing whitespace', () => {
      const content = 'key: value # comment  \nitem: value';
      const result = validator.validateYamlStructure(content, 'test.yaml');

      expect(result.valid).toBe(true);
    });
  });

  describe('validateJsonStructure', () => {
    it('should validate valid JSON', () => {
      const content = '{"key": "value", "number": 123}';
      const result = validator.validateJsonStructure(content, 'test.json');

      expect(result.valid).toBe(true);
    });

    it('should detect invalid JSON', () => {
      const content = '{"key": "value", invalid}';
      const result = validator.validateJsonStructure(content, 'test.json');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle encoding errors', () => {
      const content = '{"key": "value\0invalid"}';
      const result = validator.validateJsonStructure(content, 'test.json');

      expect(result.valid).toBe(false);
    });
  });

  describe('validateMemoryBank', () => {
    it('should handle missing optional files', async () => {
      const result = await validator.validateMemoryBank('/nonexistent/path');

      // Should return warnings for missing files, not error
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});