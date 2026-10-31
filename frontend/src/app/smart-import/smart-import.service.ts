import {
  inject,
  Injectable
} from '@angular/core';

import { firstValueFrom } from 'rxjs';

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

import {
  LocalAiService
} from '../assistant/services/local-ai.service';

import {
  normalizeSmartImportRow
} from './smart-import.normalizer';

import {
  validateSmartImportRow
} from './smart-import.validator';

@Injectable({
  providedIn: 'root'
})
export class SmartImportService {

  private readonly maxFileSizeBytes =
    2 * 1024 * 1024;

  private readonly maxImportRows = 1000;

  private readonly localAi = inject(LocalAiService);

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

    let rows = this.parseContent(
      content,
      fileType
    );

    if (rows.length === 0 && fileType !== 'csv') {
      const lineCount = content
        .replace(/\r\n?/g, '\n')
        .split('\n').length;

      if (content.length > 8000 || lineCount > 200) {
        throw new Error(
          'No structured Quests were found. Local AI extraction supports ' +
          'up to 8,000 characters and 200 lines. Split the file into smaller parts.'
        );
      }

      try {
        const result = await firstValueFrom(
          this.localAi.importPreview(content)
        );

        if (!Array.isArray(result.tasks)) {
          throw new Error('Invalid AI extraction response.');
        }

        rows = result.tasks.map(draft => {
          const row: SmartImportRow = {
            id: crypto.randomUUID(),
            sourceLine: draft.sourceLine,
            selected: true,
            title: draft.title,
            description: draft.description,
            category: draft.category,
            status: draft.status,
            workDate: draft.workDate,
            issues: []
          };

          const normalized = normalizeSmartImportRow(row);

          return {
            ...normalized,
            issues: validateSmartImportRow(normalized)
          };
        });
      } catch (error) {
        console.error('Local AI import extraction failed', error);

        throw new Error(
          'No structured Quests were found, and local AI extraction failed. ' +
          'Check that Ollama and the WorkTracker model are running.'
        );
      }
    }

    if (rows.length === 0) {
      throw new Error(
        'Neither the regular parser nor local AI could identify any Quests.'
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

    const sourceLines = content
      .replace(/\r\n?/g, '\n')
      .split('\n');

    return {
      fileName: file.name,
      fileType,
      rows: rows.map(row => ({
        ...row,
        sourceText: fileType === 'csv'
          ? ''
          : (sourceLines[row.sourceLine - 1] ?? '').trim()
      }))
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
