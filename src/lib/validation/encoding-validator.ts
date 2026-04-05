/**
 * Encoding Validator - UTF-8 and Data Integrity Validation
 * 
 * Ensures all files and data structures maintain encoding integrity
 * across long-running sessions (6+ months operational stability).
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Result of encoding validation
 */
export interface EncodingValidationResult {
  /** Overall validity */
  valid: boolean;
  /** Error message if invalid */
  error: string | null;
  /** Warning messages */
  warnings: string[];
}

/**
 * Result of validating a single file
 */
export interface FileValidationResult {
  /** File path */
  path: string;
  /** Whether file is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Encoding validator configuration
 */
export interface EncodingValidatorConfig {
  /** Check for BOM (Byte Order Mark) */
  checkBOM: boolean;
  /** Check for null bytes (corruption indicator) */
  checkNullBytes: boolean;
  /** Check for control characters */
  checkControlChars: boolean;
  /** Maximum file size to validate (bytes) */
  maxFileSize: number;
  /** Files to skip */
  skipPatterns: RegExp[];
}

const DEFAULT_CONFIG: EncodingValidatorConfig = {
  checkBOM: true,
  checkNullBytes: true,
  checkControlChars: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  skipPatterns: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
    /coverage/,
  ],
};

/**
 * Encoding Validator
 * 
 * Validates UTF-8 encoding and file integrity across the project.
 * Used at session bootstrap and before writing files.
 */
export class EncodingValidator {
  private config: EncodingValidatorConfig;

  constructor(config?: Partial<EncodingValidatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate UTF-8 encoding for a single file
   */
  validateUtf8File(filePath: string, content: string): FileValidationResult {
    // Check for BOM (Byte Order Mark)
    if (this.config.checkBOM && content.charCodeAt(0) === 0xfeff) {
      return {
        path: filePath,
        valid: false,
        error: `BOM detected in ${filePath}. UTF-8 files should not have BOM. Remove BOM and retry.`,
      };
    }

    // Check for valid UTF-8 encoding
    try {
      const buffer = Buffer.from(content, 'utf8');
      const decoded = buffer.toString('utf8');

      // Round-trip check
      if (decoded !== content) {
        return {
          path: filePath,
          valid: false,
          error: `UTF-8 round-trip failed in ${filePath}. File may contain invalid sequences.`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        path: filePath,
        valid: false,
        error: `Invalid UTF-8 encoding in ${filePath}: ${errorMessage}`,
      };
    }

    // Check for null bytes (corruption indicator)
    if (this.config.checkNullBytes && content.includes('\0')) {
      return {
        path: filePath,
        valid: false,
        error: `Null byte detected in ${filePath}. Possible file corruption.`,
      };
    }

    // Check for control characters (except newline, tab, return)
    if (this.config.checkControlChars) {
      const controlCharPattern = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
      const match = content.match(controlCharPattern);
      if (match) {
        return {
          path: filePath,
          valid: false,
          error: `Control character (0x${match[0]!.charCodeAt(0).toString(16)}) detected in ${filePath}. Possible corruption.`,
        };
      }
    }

    return {
      path: filePath,
      valid: true,
    };
  }

  /**
   * Validate multiple files
   */
  async validateFiles(filePaths: string[]): Promise<EncodingValidationResult> {
    const warnings: string[] = [];

    for (const filePath of filePaths) {
      // Skip patterns
      if (this.config.skipPatterns.some((pattern) => pattern.test(filePath))) {
        continue;
      }

      try {
        const stat = await fs.stat(filePath);

        // Check file size
        if (stat.size > this.config.maxFileSize) {
          warnings.push(`${filePath}: File too large (${stat.size} bytes), skipping validation`);
          continue;
        }

        const content = await fs.readFile(filePath, 'utf8');
        const result = this.validateUtf8File(filePath, content);

        if (!result.valid) {
          return {
            valid: false,
            error: result.error ?? 'Unknown encoding error',
            warnings,
          };
        }
      } catch (error) {
        // File doesn't exist
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          warnings.push(`${filePath}: File not found`);
          continue;
        }

        // Permission denied
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          warnings.push(`${filePath}: Permission denied`);
          continue;
        }

        // Other errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          valid: false,
          error: `${filePath}: ${errorMessage}`,
          warnings,
        };
      }
    }

    return {
      valid: true,
      error: null,
      warnings,
    };
  }

  /**
   * Validate YAML structure
   */
  validateYamlStructure(content: string, filePath: string): FileValidationResult {
    // Check UTF-8 first
    const encodingResult = this.validateUtf8File(filePath, content);
    if (!encodingResult.valid) {
      return encodingResult;
    }

    // Check for common YAML issues
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Check for tabs (should use spaces)
      if (line.includes('\t')) {
        return {
          path: filePath,
          valid: false,
          error: `Line ${lineNum} in ${filePath}: Tab character detected. YAML should use spaces, not tabs.`,
        };
      }

      // Check for trailing whitespace (can cause issues)
      if (line !== line.trimEnd() && !line.trimEnd().startsWith('#')) {
        // This is a warning, not an error
        console.warn(`Line ${lineNum} in ${filePath}: Trailing whitespace detected.`);
      }

      // Check for invalid YAML characters
      const invalidYamlChars = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;
      if (invalidYamlChars.test(line)) {
        return {
          path: filePath,
          valid: false,
          error: `Line ${lineNum} in ${filePath}: Invalid YAML character detected.`,
        };
      }
    }

    return {
      path: filePath,
      valid: true,
    };
  }

  /**
   * Validate JSON structure
   */
  validateJsonStructure(content: string, filePath: string): FileValidationResult {
    // Check UTF-8 first
    const encodingResult = this.validateUtf8File(filePath, content);
    if (!encodingResult.valid) {
      return encodingResult;
    }

    // Try to parse JSON
    try {
      JSON.parse(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        path: filePath,
        valid: false,
        error: `${filePath}: Invalid JSON - ${errorMessage}`,
      };
    }

    return {
      path: filePath,
      valid: true,
    };
  }

  /**
   * Validate TypeScript/JavaScript structure
   */
  validateCodeStructure(content: string, filePath: string): FileValidationResult {
    // Check UTF-8 first
    const encodingResult = this.validateUtf8File(filePath, content);
    if (!encodingResult.valid) {
      return encodingResult;
    }

    // Check for common issues
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Check for null bytes
      if (line.includes('\0')) {
        return {
          path: filePath,
          valid: false,
          error: `Line ${i + 1} in ${filePath}: Null byte detected in code.`,
        };
      }
    }

    return {
      path: filePath,
      valid: true,
    };
  }

  /**
   * Validate memory-bank files
   */
  async validateMemoryBank(memoryBankPath: string): Promise<EncodingValidationResult> {
    const memoryBankFiles = [
      'activeContext.md',
      'progress.md',
      'systemPatterns.md',
      'techContext.md',
      'productContext.md',
      'projectbrief.md',
    ];

    const filePaths = memoryBankFiles.map((file) =>
      path.join(memoryBankPath, file)
    );

    return this.validateFiles(filePaths);
  }

  /**
   * Validate story file
   */
  async validateStoryFile(storyPath: string): Promise<FileValidationResult> {
    try {
      const content = await fs.readFile(storyPath, 'utf8');
      return this.validateUtf8File(storyPath, content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        path: storyPath,
        valid: false,
        error: `Failed to read story file ${storyPath}: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create encoding validator
 */
export function createEncodingValidator(
  config?: Partial<EncodingValidatorConfig>
): EncodingValidator {
  return new EncodingValidator(config);
}

/**
 * Default export
 */
export default EncodingValidator;