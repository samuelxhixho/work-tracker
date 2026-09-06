import {
  Injectable
} from '@angular/core';

import {
  SmartImportFileType,
  SmartImportPreview,
  SmartImportRow
} from './smart-import.model';

import {
  parseSmartImportCsv
} from './smart-import.csv-parser';

import {
  parseSmartImportText
} from './smart-import.text-parser';

@Injectable({
  providedIn: 'root'
})
export class SmartImportService {

  private readonly maxFileSizeBytes =
    2 * 1024 * 1024;

  private readonly maxImportRows = 1000;

  async parseFile(
    file: File
  ): Promise<SmartImportPreview> {
    const fileType =
      this.getFileType(file.name);

    if (file.size === 0) {
      throw new Error(
        'The selected file is empty.'
      );
    }

    if (
      file.size >
      this.maxFileSizeBytes
    ) {
      throw new Error(
        'The selected file is too large. Maximum size is 2 MB.'
      );
    }

    const content =
      await file.text();

    if (!content.trim()) {
      throw new Error(
        'The selected file contains no content.'
      );
    }

    const rows =
      this.parseContent(
        content,
        fileType
      );

    if (rows.length === 0) {
      throw new Error(
        'No importable quests were found in this file.'
      );
    }

    if (
      rows.length >
      this.maxImportRows
    ) {
      throw new Error(
        'This file contains more than 1,000 quests. Split it into smaller files before importing.'
      );
    }

    return {
      fileName: file.name,
      fileType,
      rows
    };
  }

  private parseContent(
    content: string,
    fileType: SmartImportFileType
  ): SmartImportRow[] {
    switch (fileType) {
      case 'csv':
        return parseSmartImportCsv(content);

      case 'txt':
      case 'md':
        return parseSmartImportText(
          content,
          fileType
        );
    }
  }

  private getFileType(
    fileName: string
  ): SmartImportFileType {
    const extension =
      fileName
        .split('.')
        .pop()
        ?.toLowerCase();

    switch (extension) {
      case 'csv':
      case 'txt':
      case 'md':
        return extension;

      default:
        throw new Error(
          'Unsupported file type. Use a .txt, .md, or .csv file.'
        );
    }
  }
}
