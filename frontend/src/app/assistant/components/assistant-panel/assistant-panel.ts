import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  afterEveryRender,
  DestroyRef,
  ElementRef,
  ViewChild
} from '@angular/core';
import {Router} from '@angular/router';
import {MusicPlayerService} from '../../../pages/chill-room/services/music-player.service';
import {firstValueFrom} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
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
import {
  LocalAiAvailability,
  LocalAiChatMessage, LocalAiListCursor,
  LocalAiService
} from '../../services/local-ai.service';

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

  private readonly localAi = inject(LocalAiService);
  private readonly musicPlayer = inject(MusicPlayerService);

  readonly companionPage = signal<'home' | 'chat'>('home');

  openChat(): void {
    if (this.busy()) {
      return;
    }

    this.companionPage.set('chat');
    void this.checkLocalAi();
  }

  backToHome(): void {
    this.companionPage.set('home');
  }

  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('chatThread')
  private chatThread?: ElementRef<HTMLDivElement>;

  private lastChatElement: HTMLDivElement | null = null;
  private lastChatMessageCount = -1;
  private lastChatHeight = -1;
  private lastChatContentHeight = -1;

  readonly chatDraft = signal('');
  readonly chatMessages = signal<LocalAiChatMessage[]>([]);
  private listCursor: LocalAiListCursor | null = null;
  readonly chatSending = signal(false);
  readonly chatCancelling = signal(false);
  readonly chatError = signal('');
  readonly chatNotice = signal('');

  private activeChat: {
    id: string;
    cancelled: boolean;
    finishThinking: () => void;
  } | null = null;

  constructor() {
    afterEveryRender({
      earlyRead: () => {
        const element = this.chatThread?.nativeElement;

        if (!element) {
          this.lastChatElement = null;
          return null;
        }

        const messageCount = this.chatMessages().length;
        const height = element.clientHeight;
        const contentHeight = element.scrollHeight;

        const changed =
          element !== this.lastChatElement ||
          messageCount !== this.lastChatMessageCount ||
          height !== this.lastChatHeight ||
          contentHeight !== this.lastChatContentHeight;

        this.lastChatElement = element;
        this.lastChatMessageCount = messageCount;
        this.lastChatHeight = height;
        this.lastChatContentHeight = contentHeight;

        return changed ? {element, contentHeight} : null;
      },
      write: target => {
        if (target) {
          target.element.scrollTop = target.contentHeight;
        }
      }
    });
    this.destroyRef.onDestroy(() => {
      const request = this.activeChat;

      if (request) {
        request.cancelled = true;
        request.finishThinking();
        void this.cancelOnServer(request.id);
      }
    });
  }

  async sendChat(): Promise<void> {
    const content = this.chatDraft().trim();

    if (
      this.busy() ||
      !content ||
      content.length > 2000 ||
      this.aiAvailability()?.status !== 'AVAILABLE'
    ) {
      return;
    }

    const history = [...this.chatMessages()];
    let shortened = false;

    while (
      history.length > 0 &&
      (
        history.length > 10 ||
        history.some(message => message.content.length > 2000) ||
        history.reduce(
          (total, message) => total + message.content.length,
          content.length
        ) > 4000
      )
      ) {
      history.splice(0, 2);
      shortened = true;
    }

    const messages: LocalAiChatMessage[] = [
      ...history,
      {role: 'user', content}
    ];

    const request = {
      id: crypto.randomUUID(),
      cancelled: false,
      finishThinking: this.mascotAnimation.beginThinking()
    };

    this.activeChat = request;
    this.chatSending.set(true);
    this.chatCancelling.set(false);
    this.chatError.set('');
    this.chatNotice.set(
      shortened
        ? 'Older messages are still visible, but only recent messages are included in this reply.'
        : ''
    );
    this.chatMessages.update(current => [
      ...current,
      {role: 'user', content}
    ]);
    this.chatDraft.set('');

    let completed = false;

    try {
      const result = await firstValueFrom(
        this.localAi.chat(
          request.id,
          messages,
          this.router.url.split(/[?#]/)[0],
          {
            trackTitle: this.musicPlayer.track()?.title ?? null,
            artist: this.musicPlayer.track()?.artist ?? null,
            playing: this.musicPlayer.playing(),
            loading: this.musicPlayer.loading(),
            volume: this.musicPlayer.volume(),
            currentTime: this.musicPlayer.currentTime(),
            duration: this.musicPlayer.duration()
          },
          this.listCursor
        )
      );

      if (this.destroyRef.destroyed || request.cancelled) {
        return;
      }

      if (typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('Empty chat reply');
      }

      if (result.listCursor) {
        this.listCursor = result.listCursor;
      }

      this.chatMessages.update(current => [
        ...current,
        {role: 'assistant', content: result.reply}
      ]);
      completed = true;
    } catch (error) {
      if (!this.destroyRef.destroyed && !request.cancelled) {
        this.chatError.set(this.chatFailureMessage(error));
      }
    } finally {
      request.finishThinking();

      if (!this.destroyRef.destroyed) {
        if (!completed) {
          this.chatMessages.update(current => current.slice(0, -1));
          this.chatDraft.set(content);
        }

        if (request.cancelled) {
          this.chatNotice.set('Reply discarded. Your message is back in the input.');
        }

        this.chatSending.set(false);
        this.chatCancelling.set(false);
      }

      if (this.activeChat === request) {
        this.activeChat = null;
      }
    }
  }

  cancelChat(): void {
    const request = this.activeChat;

    if (!request || this.chatCancelling()) {
      return;
    }

    request.cancelled = true;
    this.chatCancelling.set(true);
    this.chatNotice.set('Cancelling the reply...');
    void this.cancelOnServer(request.id);
  }

  private async cancelOnServer(requestId: string): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (this.activeChat?.id !== requestId) {
        return;
      }

      try {
        const result = await firstValueFrom(
          this.localAi.cancel(requestId)
        );

        if (result.cancelled) {
          return;
        }
      } catch {
        break;
      }

      await new Promise<void>(resolve => setTimeout(resolve, 200));
    }

    if (
      !this.destroyRef.destroyed &&
      this.activeChat?.id === requestId
    ) {
      this.chatNotice.set(
        'The reply will be discarded. Waiting for the request to finish.'
      );
    }
  }

  clearChat(): void {
    if (this.chatSending()) {
      return;
    }

    this.chatMessages.set([]);
    this.listCursor = null;
    this.chatError.set('');
    this.chatNotice.set('');
  }

  private chatFailureMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'The reply could not be read. Please try again.';
    }

    switch (error.status) {
      case 400:
        return 'The message or conversation is too long. Try a shorter message.';
      case 409:
        return 'The request was cancelled. You can send your message again.';
      case 429:
        return 'Another AI request is running. Try again shortly.';
      case 502:
        return 'The model could not return a complete reply. Try a narrower question.';
      case 503:
        return 'Local AI is unavailable. Check that Ollama is running and the model is installed.';
      case 504:
        return 'Local AI took too long. Try again with a shorter message.';
      default:
        return 'Could not reach local AI. Please try again.';
    }
  }

  readonly checkingAi = signal(false);

  readonly aiAvailability =
    signal<LocalAiAvailability | null>(null);

  readonly aiAvailabilityError = signal('');

  async checkLocalAi(): Promise<void> {
    if (this.checkingAi()) {
      return;
    }

    this.checkingAi.set(true);
    this.aiAvailability.set(null);
    this.aiAvailabilityError.set('');

    try {
      const availability = await firstValueFrom(
        this.localAi.checkAvailability()
      );

      this.aiAvailability.set(availability);
    } catch {
      this.aiAvailabilityError.set(
        'Could not check local AI. Please try again.'
      );
    } finally {
      this.checkingAi.set(false);
    }
  }

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
    this.loadingWeek() ||
    this.chatSending()
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
