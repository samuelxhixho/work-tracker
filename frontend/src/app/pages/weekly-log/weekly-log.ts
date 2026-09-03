import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  ReportService
} from '../../core/services/report.service';

import {
  WeeklyReport
} from '../../reports/weekly-report.model';

@Component({
  selector: 'app-weekly-log',
  standalone: true,
  templateUrl: './weekly-log.html',
  styleUrl: './weekly-log.scss'
})
export class WeeklyLog implements OnInit {
  private readonly reportService =
    inject(ReportService);

  readonly selectedDate = signal(
    this.toLocalDateString(new Date())
  );

  readonly report =
    signal<WeeklyReport | null>(null);

  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly copyState =
    signal<'idle' | 'copied' | 'error'>('idle');

  readonly completionRate = computed(() => {
    const currentReport = this.report();

    if (
      !currentReport ||
      currentReport.totalTasks === 0
    ) {
      return 0;
    }

    return Math.round(
      (
        currentReport.completedTasks /
        currentReport.totalTasks
      ) * 100
    );
  });

  ngOnInit(): void {
    this.loadReport();
  }

  updateSelectedDate(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.selectedDate.set(input.value);
    this.loadReport();
  }

  previousWeek(): void {
    this.changeWeek(-1);
  }

  nextWeek(): void {
    this.changeWeek(1);
  }

  currentWeek(): void {
    this.selectedDate.set(
      this.toLocalDateString(new Date())
    );

    this.loadReport();
  }

  formatDisplayDate(value: string): string {
    const date = this.parseLocalDate(value);

    return new Intl.DateTimeFormat(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    ).format(date);
  }

  async copyMarkdown(): Promise<void> {
    const currentReport = this.report();

    if (!currentReport) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        currentReport.markdown
      );

      this.copyState.set('copied');

      window.setTimeout(() => {
        this.copyState.set('idle');
      }, 1800);
    } catch (error) {
      console.error(
        'Failed to copy weekly report',
        error
      );

      this.copyState.set('error');
    }
  }

  private changeWeek(direction: number): void {
    const date = this.parseLocalDate(
      this.selectedDate()
    );

    date.setDate(
      date.getDate() + direction * 7
    );

    this.selectedDate.set(
      this.toLocalDateString(date)
    );

    this.loadReport();
  }

  private loadReport(): void {
    const date = this.selectedDate();

    if (!date) {
      return;
    }

    this.loading.set(true);
    this.loadError.set(false);
    this.copyState.set('idle');

    this.reportService
      .getWeeklyReport(date)
      .subscribe({
        next: report => {
          this.report.set(report);
          this.loading.set(false);
        },

        error: error => {
          console.error(
            'Failed to load weekly report',
            error
          );

          this.report.set(null);
          this.loadError.set(true);
          this.loading.set(false);
        }
      });
  }

  private parseLocalDate(
    value: string
  ): Date {
    const [
      year,
      month,
      day
    ] = value
      .split('-')
      .map(Number);

    return new Date(
      year,
      month - 1,
      day
    );
  }

  private toLocalDateString(
    date: Date
  ): string {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
