import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {Router} from '@angular/router';

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
  | 'today'
  | 'week'
  | null;

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

  readonly loadingToday =
    signal(false);

  readonly loadingWeek =
    signal(false);

  readonly todayError =
    signal(false);

  readonly weekError =
    signal(false);

  readonly todayTasks =
    signal<Task[] | null>(null);

  readonly weeklyReport =
    signal<WeeklyReport | null>(null);

  readonly busy = computed(() =>
    this.loadingToday() ||
    this.loadingWeek()
  );

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

  openQuests(): void {
    void this.router.navigateByUrl('/quests');
  }

  openChillRoom(): void {
    void this.router.navigateByUrl('/chill-room');
  }

  private getLocalDateKey(date: Date): string {
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
