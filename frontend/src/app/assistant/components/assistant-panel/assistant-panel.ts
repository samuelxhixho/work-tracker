import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';

import {
  ReportService
} from '../../../core/services/report.service';
import {
  TaskService
} from '../../../core/services/task.service';
import {
  MascotAnimationService
} from '../../../mascot/services/mascot-animation.service';
import {
  WeeklyReport
} from '../../../reports/weekly-report.model';
import {
  Task,
  TaskStatus
} from '../../../tasks/task.model';

type AssistantView =
  | 'summary'
  | 'focus'
  | 'blocked'
  | 'today'
  | 'week'
  | null;

interface AssistantInsight {
  title: string;
  message: string;
}

interface FocusInsight extends AssistantInsight {
  task: Task | null;
}

@Component({
  selector: 'app-assistant-panel',
  standalone: true,
  templateUrl: './assistant-panel.html',
  styleUrl: './assistant-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantPanel {
  private readonly taskService =
    inject(TaskService);

  private readonly reportService =
    inject(ReportService);

  private readonly mascotAnimation =
    inject(MascotAnimationService);

  private readonly router =
    inject(Router);

  readonly closed = output<void>();

  readonly activeView =
    signal<AssistantView>(null);

  readonly loadingSummary =
    signal(false);

  readonly loadingFocus =
    signal(false);

  readonly loadingBlocked =
    signal(false);

  readonly loadingToday =
    signal(false);

  readonly loadingWeek =
    signal(false);

  readonly summaryError =
    signal(false);

  readonly focusError =
    signal(false);

  readonly blockedError =
    signal(false);

  readonly todayError =
    signal(false);

  readonly weekError =
    signal(false);

  readonly summaryInsight =
    signal<AssistantInsight | null>(null);

  readonly focusInsight =
    signal<FocusInsight | null>(null);

  readonly blockedTasks =
    signal<Task[] | null>(null);

  readonly todayTasks =
    signal<Task[] | null>(null);

  readonly weeklyReport =
    signal<WeeklyReport | null>(null);

  readonly busy = computed(() =>
    this.loadingSummary() ||
    this.loadingFocus() ||
    this.loadingBlocked() ||
    this.loadingToday() ||
    this.loadingWeek()
  );

  async loadSummary(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.activeView.set('summary');
    this.loadingSummary.set(true);
    this.summaryError.set(false);

    const finishThinking =
      this.mascotAnimation.beginThinking();

    const today =
      this.getLocalDateKey(new Date());

    try {
      const [tasks, report] =
        await Promise.all([
          firstValueFrom(
            this.taskService.getTasks(
              today,
              today
            )
          ),
          firstValueFrom(
            this.reportService.getWeeklyReport(
              today
            )
          )
        ]);

      this.todayTasks.set(tasks);
      this.weeklyReport.set(report);

      this.summaryInsight.set(
        this.buildSummaryInsight(
          tasks,
          report
        )
      );
    } catch (error) {
      console.error(
        'Failed to load companion summary',
        error
      );

      this.summaryError.set(true);
    } finally {
      this.loadingSummary.set(false);
      finishThinking();
    }
  }

  async loadFocus(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.activeView.set('focus');
    this.loadingFocus.set(true);
    this.focusError.set(false);

    const finishThinking =
      this.mascotAnimation.beginThinking();

    const today =
      this.getLocalDateKey(new Date());

    try {
      const tasks =
        await firstValueFrom(
          this.taskService.getTasks(
            today,
            today
          )
        );

      this.todayTasks.set(tasks);

      this.focusInsight.set(
        this.buildFocusInsight(tasks)
      );
    } catch (error) {
      console.error(
        'Failed to load focus insight',
        error
      );

      this.focusError.set(true);
    } finally {
      this.loadingFocus.set(false);
      finishThinking();
    }
  }

  async loadBlocked(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.activeView.set('blocked');
    this.loadingBlocked.set(true);
    this.blockedError.set(false);

    const finishThinking =
      this.mascotAnimation.beginThinking();

    try {
      const tasks =
        await firstValueFrom(
          this.taskService.getAllTasks()
        );

      const blocked =
        tasks
          .filter(
            task => task.status === 'BLOCKED'
          )
          .sort(
            (a, b) =>
              a.workDate.localeCompare(
                b.workDate
              ) ||
              a.id - b.id
          );

      this.blockedTasks.set(blocked);
    } catch (error) {
      console.error(
        'Failed to load blocked quests',
        error
      );

      this.blockedError.set(true);
    } finally {
      this.loadingBlocked.set(false);
      finishThinking();
    }
  }

  async loadToday(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.activeView.set('today');
    this.loadingToday.set(true);
    this.todayError.set(false);

    const finishThinking =
      this.mascotAnimation.beginThinking();

    const today =
      this.getLocalDateKey(new Date());

    try {
      const tasks =
        await firstValueFrom(
          this.taskService.getTasks(
            today,
            today
          )
        );

      this.todayTasks.set(tasks);
    } catch (error) {
      console.error(
        'Failed to load today\'s quests',
        error
      );

      this.todayError.set(true);
    } finally {
      this.loadingToday.set(false);
      finishThinking();
    }
  }

  async loadWeek(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.activeView.set('week');
    this.loadingWeek.set(true);
    this.weekError.set(false);

    const finishThinking =
      this.mascotAnimation.beginThinking();

    const today =
      this.getLocalDateKey(new Date());

    try {
      const report =
        await firstValueFrom(
          this.reportService.getWeeklyReport(
            today
          )
        );

      this.weeklyReport.set(report);
    } catch (error) {
      console.error(
        'Failed to load weekly progress',
        error
      );

      this.weekError.set(true);
    } finally {
      this.loadingWeek.set(false);
      finishThinking();
    }
  }

  formatStatus(status: TaskStatus): string {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';

      case 'IN_PROGRESS':
        return 'In progress';

      case 'BLOCKED':
        return 'Blocked';
    }
  }

  formatWeekRange(
    start: string,
    end: string
  ): string {
    const startDate =
      this.parseLocalDate(start);

    const endDate =
      this.parseLocalDate(end);

    const startLabel =
      startDate.toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric'
        }
      );

    const endLabel =
      endDate.toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric'
        }
      );

    return `${startLabel} – ${endLabel}`;
  }

  navigate(path: string): void {
    this.closed.emit();
    void this.router.navigateByUrl(path);
  }

  private buildSummaryInsight(
    tasks: Task[],
    report: WeeklyReport
  ): AssistantInsight {
    const completed =
      tasks.filter(
        task => task.status === 'COMPLETED'
      ).length;

    const inProgress =
      tasks.filter(
        task => task.status === 'IN_PROGRESS'
      ).length;

    const blocked =
      tasks.filter(
        task => task.status === 'BLOCKED'
      ).length;

    let title =
      'Here is your current picture.';

    if (blocked === 1) {
      title =
        'One blocker needs attention.';
    } else if (blocked > 1) {
      title =
        `${blocked} blockers need attention.`;
    } else if (inProgress > 0) {
      title =
        'You have work in motion.';
    } else if (
      tasks.length > 0 &&
      completed === tasks.length
    ) {
      title =
        'Today is complete.';
    } else if (tasks.length === 0) {
      title =
        'A quiet day so far.';
    }

    const todayMessage =
      tasks.length === 0
        ? 'No quests are logged for today.'
        : `Today: ${tasks.length} total, ${completed} completed, ${inProgress} in progress, ${blocked} blocked.`;

    const weekMessage =
      report.totalTasks === 0
        ? 'No quests are logged for this week yet.'
        : `This week: ${report.completedTasks} of ${report.totalTasks} completed.`;

    return {
      title,
      message:
        `${todayMessage} ${weekMessage}`
    };
  }

  private buildFocusInsight(
    tasks: Task[]
  ): FocusInsight {
    if (tasks.length === 0) {
      return {
        title:
          'Nothing needs your attention yet.',
        message:
          'There are no quests logged for today.',
        task: null
      };
    }

    const blocked =
      tasks.filter(
        task => task.status === 'BLOCKED'
      );

    if (blocked.length > 0) {
      const task = blocked[0];

      return {
        title:
          'Unblock this first.',
        message:
          blocked.length === 1
            ? `"${task.title}" is blocked. Clear the blocker before adding more work.`
            : `You have ${blocked.length} blocked quests. Start with "${task.title}".`,
        task
      };
    }

    const inProgress =
      tasks.filter(
        task =>
          task.status === 'IN_PROGRESS'
      );

    if (inProgress.length > 0) {
      const task = inProgress[0];

      return {
        title:
          'Finish what is already moving.',
        message:
          inProgress.length === 1
            ? `Continue "${task.title}" before starting another quest.`
            : `You have ${inProgress.length} quests in progress. Start by continuing "${task.title}".`,
        task
      };
    }

    return {
      title:
        'Today is clear.',
      message:
        'Everything logged for today is complete.',
      task: null
    };
  }

  private parseLocalDate(
    value: string
  ): Date {
    const [year, month, day] =
      value
        .split('-')
        .map(Number);

    return new Date(
      year,
      month - 1,
      day
    );
  }

  private getLocalDateKey(
    date: Date
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(date.getMonth() + 1)
        .padStart(2, '0');

    const day =
      String(date.getDate())
        .padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
