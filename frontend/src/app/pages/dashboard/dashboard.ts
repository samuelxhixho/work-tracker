import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';

import {RouterLink} from '@angular/router';

import {TaskService} from '../../core/services/task.service';
import {SettingsService} from '../../settings/settings.service';

import {
  DashboardMessage,
  DashboardMessagePeriod,
  DashboardMessageService,
  DashboardMessageSlot,
  DashboardMessageState
} from '../../core/services/dashboard-message.service';

import {Task, TaskCategory, TaskStatus} from '../../tasks/task.model';

import {QuestFormComponent} from '../../shared/components/quest-form/quest-form';

import {DeleteConfirmationComponent} from '../../shared/components/delete-confirmation/delete-confirmation';

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
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    QuestFormComponent,
    DeleteConfirmationComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly taskService =
    inject(TaskService);

  private readonly dashboardMessageService =
    inject(DashboardMessageService);

  private readonly settingsService =
    inject(SettingsService);

  readonly userName =
    signal('User');

  readonly contextualMessagesEnabled =
    signal(true);

  readonly now =
    signal(new Date());

  readonly tasks =
    signal<Task[]>([]);

  readonly loadingTasks =
    signal(true);

  readonly taskLoadError =
    signal(false);

  readonly showTaskForm =
    signal(false);

  readonly editingTask =
    signal<Task | null>(null);

  readonly taskToDelete =
    signal<Task | null>(null);

  private readonly messageRows =
    signal<DashboardMessage[]>([]);

  readonly dashboardGreeting =
    signal('Welcome back.');

  readonly heroTitle =
    signal(
      'Your progress this week feels solid.'
    );

  readonly heroBody =
    signal(
      'Small progress every day becomes something bigger over time. Keep the momentum going and log your work clearly.'
    );

  readonly focusQuote =
    signal(
      'Quiet nights build loud results.'
    );

  readonly sceneKicker =
    signal('NIGHT MODE');

  readonly sceneCaption =
    signal('Log. Build. Improve.');

  readonly focusKicker =
    signal("TONIGHT'S FOCUS");

  readonly totalTasks = computed(() =>
    this.tasks().length
  );

  readonly completedTasks = computed(() =>
    this.tasks().filter(
      task =>
        task.status === 'COMPLETED'
    ).length
  );

  readonly inProgressTasks = computed(() =>
    this.tasks().filter(
      task =>
        task.status === 'IN_PROGRESS'
    ).length
  );

  readonly blockedTasks = computed(() =>
    this.tasks().filter(
      task =>
        task.status === 'BLOCKED'
    ).length
  );

  readonly weeklyProgress =
    computed(() => {
      const total =
        this.totalTasks();

      if (total === 0) {
        return 0;
      }

      return Math.round(
        (
          this.completedTasks() /
          total
        ) * 100
      );
    });

  readonly formattedDateTime =
    computed(() => {
      const date =
        this.now();

      const weekday =
        new Intl.DateTimeFormat(
          'en-US',
          {
            weekday: 'long'
          }
        ).format(date);

      const monthDay =
        new Intl.DateTimeFormat(
          'en-US',
          {
            month: 'long',
            day: 'numeric'
          }
        ).format(date);

      const time =
        new Intl.DateTimeFormat(
          'en-US',
          {
            hour: 'numeric',
            minute: '2-digit'
          }
        ).format(date);

      return (
        `${weekday} · ` +
        `${monthDay} · ` +
        `${time}`
      ).toUpperCase();
    });

  private clockId?: number;

  ngOnInit(): void {
    this.loadSettings();
    this.refreshDashboardMessages();

    this.loadDashboardMessages();
    this.loadCurrentWeekTasks();

    this.clockId =
      window.setInterval(() => {
        const oldPeriod =
          this.getMessagePeriod(
            this.now()
          );

        const nextNow =
          new Date();

        const newPeriod =
          this.getMessagePeriod(
            nextNow
          );

        this.now.set(
          nextNow
        );

        if (
          oldPeriod !==
          newPeriod
        ) {
          this.refreshDashboardMessages();
        }
      }, 30_000);
  }

  ngOnDestroy(): void {
    if (
      this.clockId !== undefined
    ) {
      window.clearInterval(
        this.clockId
      );
    }
  }

  formatCategory(
    category: TaskCategory
  ): string {
    return CATEGORY_LABELS[
      category
      ];
  }

  formatStatus(
    status: TaskStatus
  ): string {
    return STATUS_LABELS[
      status
      ];
  }

  openTaskForm(): void {
    this.editingTask.set(null);
    this.showTaskForm.set(true);
  }

  openEditTask(
    task: Task
  ): void {
    this.editingTask.set(task);
    this.showTaskForm.set(true);
  }

  closeTaskForm(): void {
    this.showTaskForm.set(false);
    this.editingTask.set(null);
  }

  onTaskSaved(): void {
    this.closeTaskForm();
    this.loadCurrentWeekTasks();
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
    this.loadCurrentWeekTasks();
  }

  private loadSettings(): void {
    this.settingsService
      .getSettings()
      .subscribe({
        next: settings => {
          this.userName.set(
            settings.displayName
          );

          this.contextualMessagesEnabled.set(
            settings
              .contextualMessagesEnabled
          );

          this.refreshDashboardMessages();
        },

        error: error => {
          console.error(
            'Failed to load settings',
            error
          );
        }
      });
  }

  private loadDashboardMessages(): void {
    this.dashboardMessageService
      .getMessages()
      .subscribe(messages => {
        this.messageRows.set(
          messages
        );

        this.refreshDashboardMessages();
      });
  }

  private refreshDashboardMessages(): void {

    if (
      !this.contextualMessagesEnabled()
    ) {
      this.setClassicDashboardMessages();
      return;
    }

    const state =
      this.getMessageState();

    const period =
      this.getMessagePeriod(
        this.now()
      );

    this.focusKicker.set(
      this.getFocusKicker(period)
    );

    this.dashboardGreeting.set(
      this.resolveMessage(
        'GREETING',
        'ANY',
        period,
        this.getFallbackGreeting(
          period
        )
      )
    );

    this.heroTitle.set(
      this.resolveMessage(
        'HERO_TITLE',
        state,
        period,
        'Your progress this week feels solid.'
      )
    );

    this.heroBody.set(
      this.resolveMessage(
        'HERO_BODY',
        state,
        period,
        'Small progress every day becomes something bigger over time. Keep the momentum going and log your work clearly.'
      )
    );

    this.focusQuote.set(
      this.resolveMessage(
        'FOCUS_QUOTE',
        state,
        period,
        'Quiet nights build loud results.'
      )
    );

    this.sceneKicker.set(
      this.resolveMessage(
        'SCENE_KICKER',
        'ANY',
        period,
        'NIGHT MODE'
      )
    );

    this.sceneCaption.set(
      this.resolveMessage(
        'SCENE_CAPTION',
        'ANY',
        period,
        'Log. Build. Improve.'
      )
    );
  }

  private setClassicDashboardMessages(): void {
    const period =
      this.getMessagePeriod(
        this.now()
      );

    let greeting =
      'Welcome back, {name}.';

    let sceneKicker =
      'CURRENT MODE';

    let sceneCaption =
      'Log. Build. Improve.';

    switch (period) {
      case 'MORNING':
        greeting =
          'Good morning, {name}.';

        sceneKicker =
          'MORNING START';

        sceneCaption =
          'Plan. Focus. Begin.';
        break;

      case 'AFTERNOON':
        greeting =
          'Good afternoon, {name}.';

        sceneKicker =
          'AFTERNOON FLOW';

        sceneCaption =
          'Keep the momentum moving.';
        break;

      case 'EVENING':
        greeting =
          'Good evening, {name}.';

        sceneKicker =
          'EVENING MODE';

        sceneCaption =
          'Finish. Review. Reflect.';
        break;

      case 'NIGHT':
        greeting =
          'Good evening, {name}.';

        sceneKicker =
          'NIGHT MODE';

        sceneCaption =
          'Log. Build. Improve.';
        break;
    }

    this.dashboardGreeting.set(
      this.interpolateMessage(
        greeting
      )
    );

    this.heroTitle.set(
      'Your progress this week feels solid.'
    );

    this.heroBody.set(
      'Small progress every day becomes something bigger over time. Keep the momentum going and log your work clearly.'
    );

    this.focusQuote.set(
      'Quiet nights build loud results.'
    );

    this.focusKicker.set(
      this.getFocusKicker(
        period
      )
    );

    this.sceneKicker.set(
      sceneKicker
    );

    this.sceneCaption.set(
      sceneCaption
    );
  }

  private resolveMessage(
    slot: DashboardMessageSlot,
    state: DashboardMessageState,
    period: DashboardMessagePeriod,
    fallback: string
  ): string {
    const message =
      this.dashboardMessageService
        .pickMessage(
          this.messageRows(),
          slot,
          state,
          period
        );

    return this.interpolateMessage(
      message?.text ??
      fallback
    );
  }

  private interpolateMessage(
    text: string
  ): string {
    const replacements:
      Record<string, string> = {
      name:
        this.userName(),

      total:
        String(
          this.totalTasks()
        ),

      completed:
        String(
          this.completedTasks()
        ),

      inProgress:
        String(
          this.inProgressTasks()
        ),

      blocked:
        String(
          this.blockedTasks()
        ),

      progress:
        String(
          this.weeklyProgress()
        )
    };

    return text.replace(
      /[{](\w+)[}]/g,
      (
        original,
        key: string
      ) =>
        replacements[key] ??
        original
    );
  }

  private getMessageState():
    DashboardMessageState {
    const total =
      this.totalTasks();

    const completed =
      this.completedTasks();

    const blocked =
      this.blockedTasks();

    const progress =
      this.weeklyProgress();

    if (total === 0) {
      return 'NO_WORK';
    }

    if (
      completed === total
    ) {
      return 'COMPLETE';
    }

    if (
      blocked > 0 &&
      blocked / total >= 0.4
    ) {
      return 'BLOCKED';
    }

    if (
      total >= 6 ||
      progress >= 75
    ) {
      return 'STRONG';
    }

    if (
      total >= 3 ||
      progress >= 40
    ) {
      return 'STEADY';
    }

    return 'LIGHT';
  }

  private getMessagePeriod(
    date: Date
  ): DashboardMessagePeriod {
    const hour =
      date.getHours();

    if (
      hour < 5
    ) {
      return 'NIGHT';
    }

    if (
      hour < 12
    ) {
      return 'MORNING';
    }

    if (
      hour < 18
    ) {
      return 'AFTERNOON';
    }

    if (
      hour < 22
    ) {
      return 'EVENING';
    }

    return 'NIGHT';
  }

  private getFallbackGreeting(
    period: DashboardMessagePeriod
  ): string {
    switch (period) {
      case 'NIGHT':
        return 'Still awake, {name}?';

      case 'MORNING':
        return 'Good morning, {name}.';

      case 'AFTERNOON':
        return 'Good afternoon, {name}.';

      case 'EVENING':
        return 'Good evening, {name}.';

      default:
        return 'Welcome back, {name}.';
    }
  }

  private getFocusKicker(
    period: DashboardMessagePeriod
  ): string {
    switch (period) {
      case 'MORNING':
        return 'MORNING FOCUS';

      case 'AFTERNOON':
        return 'AFTERNOON FOCUS';

      case 'EVENING':
        return 'EVENING FOCUS';

      case 'NIGHT':
        return "TONIGHT'S FOCUS";

      default:
        return 'CURRENT FOCUS';
    }
  }

  private loadCurrentWeekTasks(): void {
    const today =
      new Date();

    const weekStart =
      this.getMonday(
        today
      );

    const weekEnd =
      new Date(
        weekStart
      );

    weekEnd.setDate(
      weekStart.getDate() + 6
    );

    this.loadingTasks.set(true);
    this.taskLoadError.set(false);

    this.taskService
      .getTasks(
        this.toLocalDateString(
          weekStart
        ),
        this.toLocalDateString(
          weekEnd
        )
      )
      .subscribe({
        next: tasks => {
          this.tasks.set(
            tasks
          );

          this.loadingTasks.set(
            false
          );

          this.refreshDashboardMessages();
        },

        error: error => {
          console.error(
            'Failed to load tasks',
            error
          );

          this.taskLoadError.set(
            true
          );

          this.loadingTasks.set(
            false
          );
        }
      });
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

  private toLocalDateString(
    date: Date
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        '0'
      );

    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        '0'
      );

    return (
      `${year}-${month}-${day}`
    );
  }
}
