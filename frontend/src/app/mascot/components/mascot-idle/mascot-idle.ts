import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import type { DotLottie } from '@lottiefiles/dotlottie-web';
import {
  MascotAnimationService,
  MascotAnimationState
} from '../../services/mascot-animation.service';

const ANIMATION_URLS: Record<MascotAnimationState, string> = {
  idle: '/assets/mascot/worktracker-mascot-idle.json',
  thinking: '/assets/mascot/worktracker-mascot-thinking.json'
};

const WASM_URL = '/assets/mascot/runtime/dotlottie-player.wasm';

@Component({
  selector: 'app-mascot-idle',
  standalone: true,
  templateUrl: './mascot-idle.html',
  styleUrl: './mascot-idle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MascotIdle implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly animation = inject(MascotAnimationService);

  @ViewChild('canvas', { static: true })
  private canvas!: ElementRef<HTMLCanvasElement>;

  private readonly motionQuery =
    window.matchMedia('(prefers-reduced-motion: reduce)');

  readonly reducedMotion = signal(this.motionQuery.matches);
  readonly ready = signal(false);
  readonly error = signal(false);

  private player: DotLottie | null = null;
  private destroyed = false;
  private viewReady = false;
  private initializing = false;
  private loading = false;
  private thinkingFailed = false;

  private desiredState: MascotAnimationState = 'idle';
  private requestedState: MascotAnimationState = 'idle';
  private loadedState: MascotAnimationState | null = null;

  private readonly stateEffect = effect(() => {
    const state = this.animation.state();

    untracked(() => {
      const previousState = this.desiredState;

      if (state === 'idle') {
        this.thinkingFailed = false;
      }

      if (
        previousState === 'idle' &&
        state === 'thinking' &&
        this.error()
      ) {
        this.error.set(false);
      }

      this.desiredState = state;
      this.zone.runOutsideAngular(() => this.syncAnimation());
    });
  });

  private readonly onVisibilityChange = (): void => {
    this.syncAnimation();
    this.updatePlayback();
  };

  private readonly onMotionChange = (): void => {
    this.zone.run(() => {
      this.reducedMotion.set(this.motionQuery.matches);
      this.syncAnimation();
      this.updatePlayback();
    });
  };

  ngAfterViewInit(): void {
    this.viewReady = true;

    document.addEventListener(
      'visibilitychange',
      this.onVisibilityChange
    );

    this.motionQuery.addEventListener(
      'change',
      this.onMotionChange
    );

    if (!this.reducedMotion()) {
      void this.initializePlayer();
    }
  }

  private effectiveState(): MascotAnimationState {
    return this.desiredState === 'thinking' && !this.thinkingFailed
      ? 'thinking'
      : 'idle';
  }

  private async initializePlayer(): Promise<void> {
    if (
      !this.viewReady ||
      this.initializing ||
      this.destroyed ||
      this.reducedMotion() ||
      document.hidden ||
      this.player ||
      this.error()
    ) {
      return;
    }

    this.initializing = true;

    try {
      const { DotLottie } =
        await import('@lottiefiles/dotlottie-web');

      if (
        this.destroyed ||
        this.reducedMotion() ||
        document.hidden
      ) {
        return;
      }

      DotLottie.setWasmUrl(WASM_URL);

      this.zone.runOutsideAngular(() => {
        this.requestedState = this.effectiveState();
        this.loading = true;

        const player = new DotLottie({
          canvas: this.canvas.nativeElement,
          src: ANIMATION_URLS[this.requestedState],
          autoplay: false,
          loop: true
        });

        this.player = player;

        player.addEventListener('load', () => {
          this.onLoaded();
        });

        player.addEventListener('loadError', () => {
          this.handleLoadError();
        });
      });
    } catch {
      this.handleFatalError();
    } finally {
      this.initializing = false;
    }
  }

  private syncAnimation(): void {
    if (
      !this.viewReady ||
      this.destroyed ||
      this.error() ||
      this.initializing ||
      this.loading ||
      this.reducedMotion() ||
      document.hidden
    ) {
      return;
    }

    if (!this.player) {
      void this.initializePlayer();
      return;
    }

    const nextState = this.effectiveState();

    if (this.loadedState === nextState) {
      this.updatePlayback();
      return;
    }

    this.loadState(nextState);
  }

  private loadState(state: MascotAnimationState): void {
    if (!this.player || this.destroyed) {
      return;
    }

    this.requestedState = state;
    this.loading = true;

    this.zone.run(() => this.ready.set(false));

    try {
      this.player.pause();
      this.player.load({
        src: ANIMATION_URLS[state],
        autoplay: false,
        loop: true
      });
    } catch {
      this.handleLoadError();
    }
  }

  private onLoaded(): void {
    if (this.destroyed) {
      return;
    }

    this.loading = false;
    this.loadedState = this.requestedState;

    if (this.effectiveState() !== this.loadedState) {
      this.syncAnimation();
      return;
    }

    this.zone.run(() => this.ready.set(true));
    this.updatePlayback();
  }

  private updatePlayback(): void {
    if (
      !this.player ||
      !this.ready() ||
      this.loading ||
      this.destroyed
    ) {
      return;
    }

    if (document.hidden || this.reducedMotion()) {
      this.player.pause();
    } else {
      this.player.play();
    }
  }

  private handleLoadError(): void {
    if (this.destroyed) {
      return;
    }

    this.loading = false;
    this.loadedState = null;

    if (this.requestedState === 'thinking' && !this.thinkingFailed) {
      this.thinkingFailed = true;
      this.zone.run(() => this.ready.set(false));
      this.syncAnimation();
      return;
    }

    this.handleFatalError();
  }

  private handleFatalError(): void {
    if (this.destroyed) {
      return;
    }

    this.player?.destroy();
    this.player = null;
    this.loading = false;
    this.loadedState = null;

    this.zone.run(() => {
      this.ready.set(false);
      this.error.set(true);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    document.removeEventListener(
      'visibilitychange',
      this.onVisibilityChange
    );

    this.motionQuery.removeEventListener(
      'change',
      this.onMotionChange
    );

    this.player?.destroy();
    this.player = null;
  }
}
