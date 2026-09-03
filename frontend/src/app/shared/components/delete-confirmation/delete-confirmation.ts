import {Component, HostListener, inject, input, output, signal} from '@angular/core';

import {TaskService} from '../../../core/services/task.service';

import {Task} from '../../../tasks/task.model';

@Component({
  selector: 'app-delete-confirmation',
  standalone: true,
  templateUrl: './delete-confirmation.html',
  styleUrl: './delete-confirmation.scss'
})
export class DeleteConfirmationComponent {
  private readonly taskService = inject(TaskService);

  readonly task = input.required<Task>();

  readonly closed = output<void>();
  readonly deleted = output<void>();

  readonly deleting = signal(false);
  readonly deleteError = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    if (this.deleting()) {
      return;
    }

    this.closed.emit();
  }

  confirmDelete(): void {
    if (this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.deleteError.set(false);

    this.taskService
      .deleteTask(this.task().id)
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleted.emit();
        },

        error: error => {
          console.error(
            'Failed to delete quest',
            error
          );

          this.deleting.set(false);
          this.deleteError.set(true);
        }
      });
  }
}
