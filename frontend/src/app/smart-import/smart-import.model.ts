export type SmartImportFileType =
  | 'txt'
  | 'md'
  | 'csv';

export type SmartImportField =
  | 'title'
  | 'description'
  | 'category'
  | 'status'
  | 'workDate'
  | 'duplicate';

export interface SmartImportIssue {
  field: SmartImportField;
  message: string;
}

export interface SmartImportRow {
  id: string;
  sourceLine: number;
  selected: boolean;

  title: string;
  description: string;
  category: string;
  status: string;
  workDate: string;

  issues: SmartImportIssue[];
}

export interface SmartImportPreview {
  fileName: string;
  fileType: SmartImportFileType;
  rows: SmartImportRow[];
}
