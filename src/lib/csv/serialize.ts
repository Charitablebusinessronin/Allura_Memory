/**
 * CSV Serialization Utilities
 *
 * Provides CSV escaping, serialization, and streaming for audit log exports.
 * Follows RFC 4180 for CSV formatting with proper escaping of:
 * - Double quotes (doubled: " → "")
 * - Commas (field wrapped in quotes)
 * - Newlines (field wrapped in quotes)
 * - Null/undefined values (empty string)
 *
 * Phase 7: SOC2 Compliance — Audit Log CSV Export
 */

if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSV row data — each row is an array of values matching the header order.
 */
export type CsvRow = Array<unknown>;

/**
 * Streaming CSV writer for large datasets.
 * Use this for results exceeding 1000 rows to avoid buffering entire CSV in memory.
 */
export interface CsvStream {
  /** Write the CSV header row */
  writeHeader(): void;
  /** Write a single data row */
  writeRow(row: CsvRow): void;
  /** Get the accumulated CSV string (for small datasets or testing) */
  getString(): string;
  /** Get total rows written (excluding header) */
  getRowCount(): number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV ESCAPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Characters that require a field to be quoted in CSV.
 * Per RFC 4180: fields containing commas, double quotes, or newlines must be quoted.
 */
const CSV_SPECIAL_CHARS = /[",\r\n]/;

/**
 * Escape a single value for CSV output.
 *
 * Rules (RFC 4180):
 * - null/undefined → empty string (no quotes)
 * - If value contains comma, double-quote, or newline → wrap in double quotes
 *   and double any existing double quotes
 * - Otherwise → output as-is (no quotes needed)
 *
 * @param value - The value to escape
 * @returns The CSV-escaped string representation
 */
export function escapeCsvValue(value: unknown): string {
  // Handle null/undefined as empty field
  if (value === null || value === undefined) {
    return "";
  }

  // Convert Date objects to ISO string for consistent serialization
  if (value instanceof Date) {
    return escapeCsvStringValue(value.toISOString());
  }

  // Convert to string
  const str = String(value);
  return escapeCsvStringValue(str);
}

/**
 * Escape a string value for CSV output.
 * Handles quoting and double-quote escaping per RFC 4180.
 */
function escapeCsvStringValue(str: string): string {

  // Empty string stays empty
  if (str.length === 0) {
    return "";
  }

  // Check if quoting is required
  if (CSV_SPECIAL_CHARS.test(str)) {
    // Double any existing double quotes, then wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV SERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize headers and rows into a complete CSV string.
 *
 * Suitable for small datasets (< 1000 rows). For larger datasets,
 * use `createCsvStream` to avoid buffering the entire CSV in memory.
 *
 * @param headers - Column header names
 * @param rows - Array of row data, each row matching header order
 * @returns Complete CSV string with headers and data rows
 */
export function serializeToCsv(headers: string[], rows: CsvRow[]): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeCsvValue).join(","));

  // Data rows
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV STREAMING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a streaming CSV writer for large datasets.
 *
 * Use this when exporting more than 1000 rows to avoid buffering
 * the entire CSV in memory. Call `writeHeader()` once, then `writeRow()`
 * for each data row.
 *
 * For Next.js API routes, use `ReadableStream` with the stream writer
 * to pipe CSV chunks directly to the response.
 *
 * @param headers - Column header names
 * @returns CsvStream instance for incremental CSV writing
 */
export function createCsvStream(headers: string[]): CsvStream {
  const chunks: string[] = [];
  let rowCount = 0;
  let headerWritten = false;

  const stream: CsvStream = {
    writeHeader(): void {
      if (headerWritten) {
        throw new Error("CSV header already written");
      }
      chunks.push(headers.map(escapeCsvValue).join(","));
      headerWritten = true;
    },

    writeRow(row: CsvRow): void {
      if (!headerWritten) {
        throw new Error("Must call writeHeader() before writeRow()");
      }
      chunks.push(row.map(escapeCsvValue).join(","));
      rowCount++;
    },

    getString(): string {
      return chunks.join("\n");
    },

    getRowCount(): number {
      return rowCount;
    },
  };

  return stream;
}

/**
 * Create a ReadableStream that yields CSV data in chunks.
 *
 * This is the recommended way to stream CSV in Next.js API routes.
 * It yields the header first, then each row as a separate chunk,
 * allowing the response to stream without buffering the entire dataset.
 *
 * @param headers - Column header names
 * @param rowGenerator - Async generator that yields row data
 * @returns ReadableStream that produces CSV text chunks
 */
export function createCsvReadableStream(
  headers: string[],
  rowGenerator: AsyncGenerator<CsvRow, void, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let headerSent = false;
  let firstRow = true;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Send header first
        if (!headerSent) {
          controller.enqueue(
            encoder.encode(headers.map(escapeCsvValue).join(",") + "\n")
          );
          headerSent = true;
        }

        // Yield rows from generator
        const { value, done } = await rowGenerator.next();
        if (done) {
          controller.close();
          return;
        }

        // Add newline before each row except the first data row
        const prefix = firstRow ? "" : "\n";
        firstRow = false;
        controller.enqueue(
          encoder.encode(prefix + value.map(escapeCsvValue).join(","))
        );
      } catch (error) {
        controller.error(error);
      }
    },
  });
}