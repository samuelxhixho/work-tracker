import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  TaskService
} from '../../core/services/task.service';

import {
  Task,
  TaskCategory,
  TaskStatus
} from '../../tasks/task.model';

import {
  QuestFormComponent
} from '../../shared/components/quest-form/quest-form';

import {
  DeleteConfirmationComponent
} from '../../shared/components/delete-confirmation/delete-confirmation';

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DEVOPS: 'DevOps',
  TESTING: 'Testing',
  MEETING: 'Meeting',
  OTHER: 'Other'
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked'
};

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [
    QuestFormComponent,
    DeleteConfirmationComponent
  ],
  templateUrl: './quests.html',
  styleUrl: './quests.scss'
})
export class Quests implements OnInit {
  private readonly taskService = inject(TaskService);

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly searchTerm = signal('');

  readonly categoryFilter =
    signal<TaskCategory | 'ALL'>('ALL');

  readonly statusFilter =
    signal<TaskStatus | 'ALL'>('ALL');

  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly showTaskForm = signal(false);
  readonly editingTask = signal<Task | null>(null);

  readonly taskToDelete = signal<Task | null>(null);

  readonly filteredTasks = computed(() => {
    const search = this.searchTerm()
      .trim()
      .toLowerCase();

    return [...this.tasks()]
      .filter(task => {
        if (!search) {
          return true;
        }

        const title =
          task.title.toLowerCase();

        const description =
          task.description?.toLowerCase() ?? '';

        return (
          title.includes(search) ||
          description.includes(search)
        );
      })
      .filter(task => {
        const category =
          this.categoryFilter();

        return (
          category === 'ALL' ||
          task.category === category
        );
      })
      .filter(task => {
        const status =
          this.statusFilter();

        return (
          status === 'ALL' ||
          task.status === status
        );
      })
      .filter(task => {
        const from =
          this.fromDate();

        return (
          !from ||
          task.workDate >= from
        );
      })
      .filter(task => {
        const to =
          this.toDate();

        return (
          !to ||
          task.workDate <= to
        );
      })
      .sort((a, b) => {
        const dateComparison =
          b.workDate.localeCompare(
            a.workDate
          );

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return b.updatedAt.localeCompare(
          a.updatedAt
        );
      });
  });

  readonly completedCount = computed(() =>
    this.filteredTasks()
      .filter(
        task =>
          task.status === 'COMPLETED'
      )
      .length
  );

  readonly activeCount = computed(() =>
    this.filteredTasks()
      .filter(
        task =>
          task.status === 'IN_PROGRESS'
      )
      .length
  );

  readonly blockedCount = computed(() =>
    this.filteredTasks()
      .filter(
        task =>
          task.status === 'BLOCKED'
      )
      .length
  );

  ngOnInit(): void {
    this.loadTasks();
  }

  updateSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(
      input.value
    );
  }

  updateCategory(event: Event): void {
    const select =
      event.target as HTMLSelectElement;

    this.categoryFilter.set(
      select.value as TaskCategory | 'ALL'
    );
  }

  updateStatus(event: Event): void {
    const select =
      event.target as HTMLSelectElement;

    this.statusFilter.set(
      select.value as TaskStatus | 'ALL'
    );
  }

  updateFromDate(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.fromDate.set(
      input.value
    );
  }

  updateToDate(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.toDate.set(
      input.value
    );
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.categoryFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.fromDate.set('');
    this.toDate.set('');
  }

  formatCategory(
    category: TaskCategory
  ): string {
    return CATEGORY_LABELS[category];
  }

  formatStatus(
    status: TaskStatus
  ): string {
    return STATUS_LABELS[status];
  }

  openTaskForm(): void {
    this.editingTask.set(null);
    this.showTaskForm.set(true);
  }

  openEditTask(task: Task): void {
    this.editingTask.set(task);
    this.showTaskForm.set(true);
  }

  closeTaskForm(): void {
    this.showTaskForm.set(false);
    this.editingTask.set(null);
  }

  onTaskSaved(): void {
    this.closeTaskForm();
    this.loadTasks();
  }

  openDeleteConfirmation(
    task: Task
  ): void {
    this.taskToDelete.set(task);
  }

  closeDeleteConfirmation(): void {
    this.taskToDelete.set(null);
  }

  onTaskDeleted(): void {
    this.taskToDelete.set(null);
    this.loadTasks();
  }

  private loadTasks(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.taskService
      .getAllTasks()
      .subscribe({
        next: tasks => {
          this.tasks.set(tasks);
          this.loading.set(false);
        },

        error: error => {
          console.error(
            'Failed to load quests',
            error
          );

          this.loadError.set(true);
          this.loading.set(false);
        }
      });
  }
}
