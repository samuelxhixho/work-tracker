import {
  SmartImportIssue,
  SmartImportRow
} from './smart-import.model';

const VALID_CATEGORIES = new Set([
  'FRONTEND',
  'BACKEND',
  'DEVOPS',
  'TESTING',
  'MEETING',
  'OTHER'
]);

const VALID_STATUSES = new Set([
  'COMPLETED',
  'IN_PROGRESS',
  'BLOCKED'
]);

export function validateSmartImportRow(
  row: SmartImportRow
): SmartImportIssue[] {
  const issues: SmartImportIssue[] = [];

  const title = row.title.trim();

  if (!title) {
    issues.push({
      field: 'title',
      message: 'Title is required.'
    });
  } else if (title.length > 200) {
    issues.push({
      field: 'title',
      message: 'Title cannot exceed 200 characters.'
    });
  }

  if (!VALID_CATEGORIES.has(row.category)) {
    issues.push({
      field: 'category',
      message: 'Category is invalid.'
    });
  }

  if (!VALID_STATUSES.has(row.status)) {
    issues.push({
      field: 'status',
      message: 'Status is invalid.'
    });
  }

  if (!isValidIsoDate(row.workDate)) {
    issues.push({
      field: 'workDate',
      message: 'Work date must be a valid date.'
    });
  }

  return issues;
}

export function isSmartImportRowValid(
  row: SmartImportRow
): boolean {
  return validateSmartImportRow(row).length === 0;
}

function isValidIsoDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
