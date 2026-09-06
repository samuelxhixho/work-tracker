import {
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal,
  ElementRef,
  viewChild
} from '@angular/core';

import {
  SmartImportService
} from '../../smart-import.service';

import {
  SmartImportPreview,
  SmartImportRow
} from '../../smart-import.model';

import {
  validateSmartImportRow
} from '../../smart-import.validator';

import {
  CreateTaskRequest,
  Task,
  TaskCategory,
  TaskStatus
} from '../../../tasks/task.model';

import {
  TaskService
} from '../../../core/services/task.service';

import {
  firstValueFrom
} from 'rxjs';

@Component({
  selector: 'app-smart-import-modal',
  standalone: true,
  templateUrl: './smart-import-modal.html',
  styleUrl: './smart-import-modal.scss'
})
export class SmartImportModalComponent {
  private readonly smartImportService =
    inject(SmartImportService);

  private readonly taskService =
    inject(TaskService);

  readonly closed = output<void>();

  readonly imported = output<void>();

  readonly preview =
    signal<SmartImportPreview | null>(null);

  readonly existingTasks =
    signal<Task[]>([]);

  readonly parsing = signal(false);
  readonly parseError = signal('');

  readonly importing = signal(false);
  readonly importError = signal('');

  readonly isDragging = signal(false);

  readonly pageSize = 50;
  readonly currentPage = signal(1);

  readonly previewStart =
    viewChild<ElementRef<HTMLElement>>(
      'previewStart'
    );

  readonly invalidRowCount = computed(() =>
    this.preview()?.rows.filter(
      row => row.issues.length > 0
    ).length ?? 0
  );

  readonly selectedRowCount = computed(() =>
    this.preview()?.rows.filter(
      row => row.selected
    ).length ?? 0
  );

  readonly selectedInvalidRowCount = computed(() =>
    this.preview()?.rows.filter(
      row =>
        row.selected &&
        row.issues.length > 0
    ).length ?? 0
  );

  readonly canImport = computed(() =>
    this.selectedRowCount() > 0 &&
    this.selectedInvalidRowCount() === 0 &&
    !this.importing()
  );

  readonly allRowsSelected = computed(() => {
    const rows = this.preview()?.rows ?? [];

    return (
      rows.length > 0 &&
      rows.every(row => row.selected)
    );
  });

  readonly totalPages = computed(() => {
    const rowCount =
      this.preview()?.rows.length ?? 0;

    return Math.max(
      1,
      Math.ceil(
        rowCount / this.pageSize
      )
    );
  });

  readonly visibleRows = computed(() => {
    const rows =
      this.preview()?.rows ?? [];

    const start =
      (this.currentPage() - 1) *
      this.pageSize;

    return rows.slice(
      start,
      start + this.pageSize
    );
  });

  readonly firstVisibleRowNumber =
    computed(() => {
      if (this.visibleRows().length === 0) {
        return 0;
      }

      return (
        (this.currentPage() - 1) *
        this.pageSize
      ) + 1;
    });

  readonly lastVisibleRowNumber =
    computed(() => {
      return Math.min(
        this.currentPage() *
        this.pageSize,
        this.preview()?.rows.length ?? 0
      );
    });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    if (
      this.parsing() ||
      this.importing()
    ) {
      return;
    }

    this.closed.emit();
  }

  private scrollToPreviewStart(): void {
    queueMicrotask(() => {
      this.previewStart()
        ?.nativeElement
        .scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    });
  }

  previousPage(): void {
    if (this.currentPage() <= 1) {
      return;
    }

    this.currentPage.update(
      page => page - 1
    );

    this.scrollToPreviewStart();
  }

  nextPage(): void {
    if (
      this.currentPage() >=
      this.totalPages()
    ) {
      return;
    }

    this.currentPage.update(
      page => page + 1
    );

    this.scrollToPreviewStart();
  }

  toggleRow(
    rowId: string
  ): void {
    this.updateRow(
      rowId,
      row => ({
        ...row,
        selected: !row.selected
      })
    );
  }

  toggleAllRows(): void {
    const selected =
      !this.allRowsSelected();

    this.preview.update(preview => {
      if (!preview) {
        return preview;
      }

      return {
        ...preview,
        rows: preview.rows.map(row => ({
          ...row,
          selected
        }))
      };
    });
  }

  updateTitle(
    rowId: string,
    event: Event
  ): void {
    this.updateField(
      rowId,
      'title',
      this.getInputValue(event)
    );
  }

  updateDescription(
    rowId: string,
    event: Event
  ): void {
    this.updateField(
      rowId,
      'description',
      this.getInputValue(event)
    );
  }

  updateCategory(
    rowId: string,
    event: Event
  ): void {
    this.updateField(
      rowId,
      'category',
      this.getInputValue(event)
    );
  }

  updateStatus(
    rowId: string,
    event: Event
  ): void {
    this.updateField(
      rowId,
      'status',
      this.getInputValue(event)
    );
  }

  updateWorkDate(
    rowId: string,
    event: Event
  ): void {
    this.updateField(
      rowId,
      'workDate',
      this.getInputValue(event)
    );
  }

  private updateField(
    rowId: string,
    field:
      | 'title'
      | 'description'
      | 'category'
      | 'status'
      | 'workDate',
    value: string
  ): void {
    this.updateRow(
      rowId,
      row => {
        const updatedRow = {
          ...row,
          [field]: value
        };

        return this.revalidateRow(updatedRow);
      }
    );
  }

  private revalidateRows(
    rows: SmartImportRow[]
  ): SmartImportRow[] {
    const signatureCounts =
      new Map<string, number>();

    for (const row of rows) {
      const signature =
        this.getRowSignature(row);

      signatureCounts.set(
        signature,
        (signatureCounts.get(signature) ?? 0) + 1
      );
    }

    return rows.map(row =>
      this.revalidateRow(
        row,
        signatureCounts
      )
    );
  }

  private revalidateRow(
    row: SmartImportRow,
    signatureCounts:
    Map<string, number> =
    new Map()
  ): SmartImportRow {
    const issues =
      validateSmartImportRow(row);

    if (
      issues.length === 0 &&
      this.isDuplicate(row)
    ) {
      issues.push({
        field: 'duplicate',
        message:
          'An identical quest already exists.'
      });
    }

    if (
      issues.length === 0 &&
      (
        signatureCounts.get(
          this.getRowSignature(row)
        ) ?? 0
      ) > 1
    ) {
      issues.push({
        field: 'duplicate',
        message:
          'This quest appears more than once in the import.'
      });
    }

    return {
      ...row,
      issues
    };
  }

  private isDuplicate(
    row: SmartImportRow
  ): boolean {
    const title =
      this.normalizeDuplicateValue(row.title);

    const description =
      this.normalizeDuplicateValue(
        row.description
      );

    return this.existingTasks().some(task =>
      this.normalizeDuplicateValue(
        task.title
      ) === title &&
      this.normalizeDuplicateValue(
        task.description ?? ''
      ) === description &&
      task.category === row.category &&
      task.status === row.status &&
      task.workDate === row.workDate
    );
  }

  private getRowSignature(
    row: SmartImportRow
  ): string {
    return [
      this.normalizeDuplicateValue(
        row.title
      ),
      this.normalizeDuplicateValue(
        row.description
      ),
      row.category,
      row.status,
      row.workDate
    ].join('|');
  }

  private normalizeDuplicateValue(
    value: string
  ): string {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private updateRow(
    rowId: string,
    updater:
    (row: SmartImportRow) =>
      SmartImportRow
  ): void {
    this.preview.update(preview => {
      if (!preview) {
        return preview;
      }

      const updatedRows =
        preview.rows.map(row =>
          row.id === rowId
            ? updater(row)
            : row
        );

      return {
        ...preview,
        rows:
          this.revalidateRows(
            updatedRows
          )
      };
    });
  }

  private getInputValue(
    event: Event
  ): string {
    return (
      event.target as
        HTMLInputElement |
        HTMLTextAreaElement |
        HTMLSelectElement
    ).value;
  }

  importSelected(): void {
    if (!this.canImport()) {
      return;
    }

    const preview = this.preview();

    if (!preview) {
      return;
    }

    const tasks: CreateTaskRequest[] =
      preview.rows
        .filter(row => row.selected)
        .map(row => ({
          title: row.title.trim(),
          description:
            row.description.trim() || null,
          category:
            row.category as TaskCategory,
          status:
            row.status as TaskStatus,
          workDate: row.workDate
        }));

    this.importing.set(true);
    this.importError.set('');

    this.taskService
      .createTasksBatch({
        tasks
      })
      .subscribe({
        next: () => {
          this.importing.set(false);
          this.imported.emit();
        },

        error: error => {
          console.error(
            'Failed to import quests',
            error
          );

          this.importing.set(false);
          this.importError.set(
            'The quests could not be imported.'
          );
        }
      });
  }

  onFileSelected(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    input.value = '';

    if (!file) {
      return;
    }

    void this.loadFile(file);
  }

  private async loadFile(
    file: File
  ): Promise<void> {
    this.parsing.set(true);
    this.parseError.set('');
    this.importError.set('');
    this.preview.set(null);
    this.currentPage.set(1);

    try {
      const [
        preview,
        existingTasks
      ] = await Promise.all([
        this.smartImportService
          .parseFile(file),

        firstValueFrom(
          this.taskService.getAllTasks()
        )
      ]);

      this.existingTasks.set(
        existingTasks
      );

      const validatedRows =
        this.revalidateRows(
          preview.rows
        );

      this.preview.set({
        ...preview,
        rows: validatedRows
      });
    } catch (error) {
      console.error(
        'Failed to parse import file',
        error
      );

      this.parseError.set(
        error instanceof Error
          ? error.message
          : 'The file could not be parsed.'
      );
    } finally {
      this.parsing.set(false);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (
      this.parsing() ||
      this.importing()
    ) {
      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();

    this.isDragging.set(false);

    if (
      this.parsing() ||
      this.importing()
    ) {
      return;
    }

    const file =
      event.dataTransfer?.files?.[0];

    if (!file) {
      return;
    }

    void this.loadFile(file);
  }
}
