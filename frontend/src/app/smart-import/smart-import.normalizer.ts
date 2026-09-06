import {
  SmartImportRow
} from './smart-import.model';

const CATEGORY_ALIASES: Record<string, string> = {
  frontend: 'FRONTEND',
  'front end': 'FRONTEND',
  'front-end': 'FRONTEND',

  backend: 'BACKEND',
  'back end': 'BACKEND',
  'back-end': 'BACKEND',

  devops: 'DEVOPS',
  'dev ops': 'DEVOPS',

  testing: 'TESTING',
  test: 'TESTING',
  qa: 'TESTING',

  meeting: 'MEETING',
  meetings: 'MEETING',

  other: 'OTHER',
  misc: 'OTHER',
  miscellaneous: 'OTHER'
};

const STATUS_ALIASES: Record<string, string> = {
  completed: 'COMPLETED',
  complete: 'COMPLETED',
  done: 'COMPLETED',

  'in progress': 'IN_PROGRESS',
  'in-progress': 'IN_PROGRESS',
  in_progress: 'IN_PROGRESS',
  active: 'IN_PROGRESS',

  blocked: 'BLOCKED'
};

export function normalizeSmartImportRow(
  row: SmartImportRow
): SmartImportRow {
  return {
    ...row,
    title: row.title.trim(),
    description: row.description.trim(),
    category: normalizeCategory(row.category),
    status: normalizeStatus(row.status),
    workDate: row.workDate.trim(),
    issues: []
  };
}

function normalizeCategory(value: string): string {
  const normalized = normalizeLookupValue(value);

  return (
    CATEGORY_ALIASES[normalized] ??
    value.trim().toUpperCase()
  );
}

function normalizeStatus(value: string): string {
  const normalized = normalizeLookupValue(value);

  return (
    STATUS_ALIASES[normalized] ??
    value.trim().toUpperCase()
  );
}

function normalizeLookupValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
