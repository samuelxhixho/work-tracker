import {
  SmartImportFileType,
  SmartImportRow
} from './smart-import.model';

import {
  normalizeSmartImportRow
} from './smart-import.normalizer';

import {
  validateSmartImportRow
} from './smart-import.validator';

interface ParsedBlock {
  sourceLine: number;
  title: string;
  description: string;
  category: string;
  status: string;
  workDate: string;
}

export function parseSmartImportText(
  content: string,
  fileType: Extract<
    SmartImportFileType,
    'txt' | 'md'
  >
): SmartImportRow[] {
  const parsedBlocks = hasDatedLogSections(content)
    ? parseDatedLog(content)
    : splitIntoBlocks(content)
      .map(block =>
        parseBlock(
          block.lines,
          block.sourceLine,
          fileType
        )
      )
      .filter(
        (block): block is ParsedBlock =>
          block !== null
      );

  return parsedBlocks.map(block =>
    createSmartImportRow(block)
  );
}

function hasDatedLogSections(
  content: string
): boolean {
  return normalizeLines(content)
    .some(line =>
      parseDatedLogDate(line) !== null
    );
}

function parseDatedLog(
  content: string
): ParsedBlock[] {
  const lines = normalizeLines(content);

  const blocks: ParsedBlock[] = [];

  let currentDate = '';
  let currentBlock: ParsedBlock | null = null;

  const flushCurrentBlock = (): void => {
    if (!currentBlock) {
      return;
    }

    blocks.push(
      splitDatedLogContent(currentBlock)
    );

    currentBlock = null;
  };

  lines.forEach((line, index) => {
    const date = parseDatedLogDate(line);

    if (date) {
      flushCurrentBlock();
      currentDate = date;
      return;
    }

    const bulletMatch =
      /^\s*[*-]\s+(.+)$/.exec(line);

    if (bulletMatch && currentDate) {
      flushCurrentBlock();

      currentBlock = {
        sourceLine: index + 1,
        title: bulletMatch[1].trim(),
        description: '',
        category: 'OTHER',
        status: 'COMPLETED',
        workDate: currentDate
      };

      return;
    }

    if (
      currentBlock &&
      line.trim()
    ) {
      currentBlock.title = [
        currentBlock.title,
        line.trim()
      ]
        .filter(Boolean)
        .join(' ');
    }
  });

  flushCurrentBlock();

  return blocks;
}

function splitDatedLogContent(
  block: ParsedBlock
): ParsedBlock {
  const text = block.title
    .replace(/\s+/g, ' ')
    .trim();

  const colonIndex =
    text.indexOf(':');

  if (
    colonIndex >= 20 &&
    colonIndex <= 160
  ) {
    const description =
      text
        .slice(colonIndex + 1)
        .trim();

    if (description) {
      return {
        ...block,
        title: text
          .slice(0, colonIndex)
          .trim(),
        description
      };
    }
  }

  const sentenceMatch =
    /^(.{20,200}?[.!?])(?:\s+|$)(.+)$/
      .exec(text);

  if (sentenceMatch) {
    return {
      ...block,
      title: sentenceMatch[1].trim(),
      description: sentenceMatch[2].trim()
    };
  }

  if (text.length <= 200) {
    return {
      ...block,
      title: text,
      description: ''
    };
  }

  const wordBoundary =
    text.lastIndexOf(' ', 200);

  const splitIndex =
    wordBoundary > 0
      ? wordBoundary
      : 200;

  return {
    ...block,
    title:
      text.slice(0, splitIndex).trim(),
    description:
      text.slice(splitIndex).trim()
  };
}

function parseDatedLogDate(
  line: string
): string | null {
  const match =
    /^\s*Dt\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s*:\s*$/i
      .exec(line);

  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function splitIntoBlocks(
  content: string
): Array<{
  sourceLine: number;
  lines: string[];
}> {
  const lines = normalizeLines(content);

  const blocks: Array<{
    sourceLine: number;
    lines: string[];
  }> = [];

  let currentLines: string[] = [];
  let currentStartLine = 1;

  lines.forEach((line, index) => {
    if (!line.trim()) {
      if (currentLines.length > 0) {
        blocks.push({
          sourceLine: currentStartLine,
          lines: currentLines
        });

        currentLines = [];
      }

      return;
    }

    if (currentLines.length === 0) {
      currentStartLine = index + 1;
    }

    currentLines.push(line);
  });

  if (currentLines.length > 0) {
    blocks.push({
      sourceLine: currentStartLine,
      lines: currentLines
    });
  }

  return blocks;
}

function parseBlock(
  lines: string[],
  sourceLine: number,
  fileType: Extract<
    SmartImportFileType,
    'txt' | 'md'
  >
): ParsedBlock | null {
  const values: ParsedBlock = {
    sourceLine,
    title: '',
    description: '',
    category: '',
    status: '',
    workDate: ''
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      fileType === 'md' &&
      /^#{1,6}\s+/.test(trimmed)
    ) {
      values.title = trimmed
        .replace(/^#{1,6}\s+/, '')
        .trim();

      continue;
    }

    const normalizedLine =
      trimmed.replace(/^[-*]\s+/, '');

    const separatorIndex =
      normalizedLine.indexOf(':');

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine
      .slice(0, separatorIndex)
      .trim()
      .toLowerCase();

    const value = normalizedLine
      .slice(separatorIndex + 1)
      .trim();

    switch (key) {
      case 'title':
        values.title = value;
        break;

      case 'description':
        values.description = value;
        break;

      case 'category':
        values.category = value;
        break;

      case 'status':
        values.status = value;
        break;

      case 'workdate':
      case 'work date':
      case 'date':
        values.workDate = value;
        break;
    }
  }

  const hasContent =
    values.title ||
    values.description ||
    values.category ||
    values.status ||
    values.workDate;

  return hasContent ? values : null;
}

function createSmartImportRow(
  block: ParsedBlock
): SmartImportRow {
  const row: SmartImportRow = {
    id: crypto.randomUUID(),
    sourceLine: block.sourceLine,
    selected: true,
    title: block.title,
    description: block.description,
    category: block.category,
    status: block.status,
    workDate: block.workDate,
    issues: []
  };

  const normalized =
    normalizeSmartImportRow(row);

  return {
    ...normalized,
    issues:
      validateSmartImportRow(normalized)
  };
}

function normalizeLines(
  content: string
): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}
