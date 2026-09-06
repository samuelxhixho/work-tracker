import {
  SmartImportRow
} from './smart-import.model';

import {
  normalizeSmartImportRow
} from './smart-import.normalizer';

import {
  validateSmartImportRow
} from './smart-import.validator';

const REQUIRED_HEADERS = [
  'title',
  'description',
  'category',
  'status',
  'workDate'
] as const;

interface CsvRecord {
  values: string[];
  sourceLine: number;
}

export function parseSmartImportCsv(
  content: string
): SmartImportRow[] {
  const records = parseCsvRecords(content);

  if (records.length === 0) {
    return [];
  }

  const headers = records[0].values.map(
    header => header.trim()
  );

  validateHeaders(headers);

  const headerIndexes = new Map(
    headers.map((header, index) => [
      header,
      index
    ])
  );

  return records
    .slice(1)
    .filter(record =>
      record.values.some(
        value => value.trim()
      )
    )
    .map(record => {
      const row: SmartImportRow = {
        id: crypto.randomUUID(),
        sourceLine: record.sourceLine,
        selected: true,

        title: getValue(
          record.values,
          headerIndexes,
          'title'
        ),

        description: getValue(
          record.values,
          headerIndexes,
          'description'
        ),

        category: getValue(
          record.values,
          headerIndexes,
          'category'
        ),

        status: getValue(
          record.values,
          headerIndexes,
          'status'
        ),

        workDate: getValue(
          record.values,
          headerIndexes,
          'workDate'
        ),

        issues: []
      };

      const normalized =
        normalizeSmartImportRow(row);

      return {
        ...normalized,
        issues:
          validateSmartImportRow(normalized)
      };
    });
}

function validateHeaders(
  headers: string[]
): void {
  const missingHeaders =
    REQUIRED_HEADERS.filter(
      header => !headers.includes(header)
    );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing CSV columns: ${missingHeaders.join(', ')}`
    );
  }
}

function getValue(
  record: string[],
  headerIndexes: Map<string, number>,
  header: string
): string {
  const index = headerIndexes.get(header);

  if (index === undefined) {
    return '';
  }

  return record[index] ?? '';
}

function parseCsvRecords(
  content: string
): CsvRecord[] {
  const records: CsvRecord[] = [];

  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let afterClosingQuote = false;
  let lineNumber = 1;
  let recordStartLine = 1;

  const pushField = (): void => {
    record.push(field);
    field = '';
    afterClosingQuote = false;
  };

  const pushRecord = (): void => {
    pushField();

    if (
      record.some(value => value.length > 0)
    ) {
      records.push({
        values: record,
        sourceLine: recordStartLine
      });
    }

    record = [];
  };

  for (
    let i = 0;
    i < content.length;
    i++
  ) {
    const character = content[i];

    if (inQuotes) {
      if (character === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }

        continue;
      }

      if (character === '\n') {
        lineNumber++;
      } else if (
        character === '\r' &&
        content[i + 1] !== '\n'
      ) {
        lineNumber++;
      }

      field += character;
      continue;
    }

    if (afterClosingQuote) {
      if (
        character === ' ' ||
        character === '\t'
      ) {
        continue;
      }

      if (character === ',') {
        pushField();
        continue;
      }

      if (
        character === '\n' ||
        character === '\r'
      ) {
        if (
          character === '\r' &&
          content[i + 1] === '\n'
        ) {
          i++;
        }

        pushRecord();
        lineNumber++;
        recordStartLine = lineNumber;
        continue;
      }

      throw new Error(
        `Malformed CSV near line ${lineNumber}.`
      );
    }

    if (character === '"') {
      if (field.trim().length > 0) {
        throw new Error(
          `Malformed CSV near line ${lineNumber}.`
        );
      }

      field = '';
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      pushField();
      continue;
    }

    if (
      character === '\n' ||
      character === '\r'
    ) {
      if (
        character === '\r' &&
        content[i + 1] === '\n'
      ) {
        i++;
      }

      pushRecord();
      lineNumber++;
      recordStartLine = lineNumber;
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error(
      `The CSV file contains an unclosed quoted value near line ${lineNumber}.`
    );
  }

  pushRecord();

  return records;
}
