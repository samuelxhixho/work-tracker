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

interface HistoryStatusGroup {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}

interface HistoryWeek {
  key: string;
  weekStart: string;
  weekEnd: string;

  total: number;
  completed: number;
  inProgress: number;
  blocked: number;

  completionRate: number;

  groups: HistoryStatusGroup[];
}

interface HistoryWeekBucket {
  weekStart: string;
  weekEnd: string;

  completedTasks: Task[];
  inProgressTasks: Task[];
  blockedTasks: Task[];
}

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DEVOPS: 'DevOps',
  TESTING: 'Testing',
  MEETING: 'Meeting',
  OTHER: 'Other'
};

@Component({
  selector: 'app-history',
  standalone: true,
  templateUrl: './history.html',
  styleUrl: './history.scss'
})
export class History implements OnInit {
  private readonly taskService = inject(TaskService);

  readonly tasks = signal<Task[]>([]);

  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly searchTerm = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly expandedWeeks =
    signal<Set<string>>(new Set());

  readonly collapsedStatusGroups =
    signal<Set<string>>(new Set());

  readonly filteredTasks = computed(() => {
    const search = this.searchTerm()
      .trim()
      .toLowerCase();

    const from = this.fromDate();
    const to = this.toDate();

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
        return (
          !from ||
          task.workDate >= from
        );
      })
      .filter(task => {
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

  readonly historyWeeks = computed<HistoryWeek[]>(() => {
    const groupedWeeks =
      new Map<string, HistoryWeekBucket>();

    for (const task of this.filteredTasks()) {
      const workDate =
        this.parseLocalDate(task.workDate);

      const weekStartDate =
        this.getMonday(workDate);

      const weekEndDate =
        new Date(weekStartDate);

      weekEndDate.setDate(
        weekStartDate.getDate() + 6
      );

      const weekStart =
        this.toLocalDateString(
          weekStartDate
        );

      const weekEnd =
        this.toLocalDateString(
          weekEndDate
        );

      let bucket =
        groupedWeeks.get(weekStart);

      if (!bucket) {
        bucket = {
          weekStart,
          weekEnd,
          completedTasks: [],
          inProgressTasks: [],
          blockedTasks: []
        };

        groupedWeeks.set(
          weekStart,
          bucket
        );
      }

      switch (task.status) {
        case 'COMPLETED':
          bucket.completedTasks.push(task);
          break;

        case 'IN_PROGRESS':
          bucket.inProgressTasks.push(task);
          break;

        case 'BLOCKED':
          bucket.blockedTasks.push(task);
          break;
      }
    }

    return Array.from(
      groupedWeeks.entries()
    )
      .sort(([a], [b]) =>
        b.localeCompare(a)
      )
      .map(([key, bucket]) => {
        const completed =
          bucket.completedTasks.length;

        const inProgress =
          bucket.inProgressTasks.length;

        const blocked =
          bucket.blockedTasks.length;

        const total =
          completed +
          inProgress +
          blocked;

        const completionRate =
          total === 0
            ? 0
            : Math.round(
              (completed / total) * 100
            );

        return {
          key,
          weekStart: bucket.weekStart,
          weekEnd: bucket.weekEnd,

          total,
          completed,
          inProgress,
          blocked,

          completionRate,

          groups: [
            {
              status: 'COMPLETED',
              label: 'Completed',
              tasks:
              bucket.completedTasks
            },
            {
              status: 'IN_PROGRESS',
              label: 'In Progress',
              tasks:
              bucket.inProgressTasks
            },
            {
              status: 'BLOCKED',
              label: 'Blocked',
              tasks:
              bucket.blockedTasks
            }
          ]
        };
      });
  });

  readonly totalWeeks = computed(() =>
    this.historyWeeks().length
  );

  readonly totalQuests = computed(() =>
    this.filteredTasks().length
  );

  readonly completedQuests = computed(() =>
    this.filteredTasks().filter(
      task =>
        task.status === 'COMPLETED'
    ).length
  );

  readonly overallCompletionRate =
    computed(() => {
      const total =
        this.totalQuests();

      if (total === 0) {
        return 0;
      }

      return Math.round(
        (
          this.completedQuests() /
          total
        ) * 100
      );
    });

  ngOnInit(): void {
    this.loadHistory();
  }

  updateSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(
      input.value
    );

    this.syncExpansionForFilters();
  }

  updateFromDate(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.fromDate.set(
      input.value
    );

    this.syncExpansionForFilters();
  }

  updateToDate(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.toDate.set(
      input.value
    );

    this.syncExpansionForFilters();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.fromDate.set('');
    this.toDate.set('');

    this.collapsedStatusGroups.set(
      new Set()
    );

    this.resetDefaultExpansion();
  }

  toggleWeek(weekKey: string): void {
    const updated =
      new Set(
        this.expandedWeeks()
      );

    if (updated.has(weekKey)) {
      updated.delete(weekKey);
    } else {
      updated.add(weekKey);
    }

    this.expandedWeeks.set(
      updated
    );
  }

  isWeekExpanded(
    weekKey: string
  ): boolean {
    return this.expandedWeeks()
      .has(weekKey);
  }

  toggleStatusGroup(
    weekKey: string,
    status: TaskStatus
  ): void {
    const key =
      this.getStatusGroupKey(
        weekKey,
        status
      );

    const updated =
      new Set(
        this.collapsedStatusGroups()
      );

    if (updated.has(key)) {
      updated.delete(key);
    } else {
      updated.add(key);
    }

    this.collapsedStatusGroups.set(
      updated
    );
  }

  isStatusExpanded(
    weekKey: string,
    status: TaskStatus
  ): boolean {
    const key =
      this.getStatusGroupKey(
        weekKey,
        status
      );

    return !this
      .collapsedStatusGroups()
      .has(key);
  }

  formatCategory(
    category: TaskCategory
  ): string {
    return CATEGORY_LABELS[category];
  }

  formatWeekRange(
    weekStart: string,
    weekEnd: string
  ): string {
    const start =
      this.parseLocalDate(weekStart);

    const end =
      this.parseLocalDate(weekEnd);

    const startYear =
      start.getFullYear();

    const endYear =
      end.getFullYear();

    const startLabel =
      new Intl.DateTimeFormat(
        'en-US',
        {
          month: 'short',
          day: 'numeric'
        }
      )
        .format(start)
        .toUpperCase();

    const endLabel =
      new Intl.DateTimeFormat(
        'en-US',
        {
          month: 'short',
          day: 'numeric'
        }
      )
        .format(end)
        .toUpperCase();

    if (startYear === endYear) {
      return (
        `${startLabel} – ` +
        `${endLabel}, ${endYear}`
      );
    }

    return (
      `${startLabel}, ${startYear} – ` +
      `${endLabel}, ${endYear}`
    );
  }

  formatQuestDate(
    workDate: string
  ): string {
    const date =
      this.parseLocalDate(workDate);

    return new Intl.DateTimeFormat(
      'en-US',
      {
        month: 'short',
        day: 'numeric'
      }
    ).format(date);
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.taskService
      .getAllTasks()
      .subscribe({
        next: tasks => {
          this.tasks.set(tasks);

          this.loading.set(false);

          this.resetDefaultExpansion();
        },

        error: error => {
          console.error(
            'Failed to load history',
            error
          );

          this.loadError.set(true);
          this.loading.set(false);
        }
      });
  }

  private syncExpansionForFilters(): void {
    const search =
      this.searchTerm().trim();

    if (search) {
      this.expandedWeeks.set(
        new Set(
          this.historyWeeks().map(
            week => week.key
          )
        )
      );

      this.collapsedStatusGroups.set(
        new Set()
      );

      return;
    }

    this.resetDefaultExpansion();
  }

  private resetDefaultExpansion(): void {
    const firstWeek =
      this.historyWeeks()[0];

    this.expandedWeeks.set(
      firstWeek
        ? new Set([firstWeek.key])
        : new Set()
    );
  }

  private getStatusGroupKey(
    weekKey: string,
    status: TaskStatus
  ): string {
    return `${weekKey}:${status}`;
  }

  private getMonday(
    date: Date
  ): Date {
    const result =
      new Date(date);

    const day =
      result.getDay();

    const difference =
      day === 0
        ? -6
        : 1 - day;

    result.setDate(
      result.getDate() +
      difference
    );

    result.setHours(
      0,
      0,
      0,
      0
    );

    return result;
  }

  private parseLocalDate(
    date: string
  ): Date {
    return new Date(
      `${date}T00:00:00`
    );
  }

  private toLocalDateString(
    date: Date
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    return (
      `${year}-${month}-${day}`
    );
  }
}
