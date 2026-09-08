import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import type { DotLottie } from '@lottiefiles/dotlottie-web';

const ANIMATION_URL = '/assets/mascot/worktracker-mascot-idle.json';
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

  @ViewChild('canvas', { static: true })
  private canvas!: ElementRef<HTMLCanvasElement>;

  private readonly motionQuery =
    window.matchMedia('(prefers-reduced-motion: reduce)');

  readonly reducedMotion = signal(this.motionQuery.matches);
  readonly ready = signal(false);
  readonly error = signal(false);

  private player: DotLottie | null = null;
  private destroyed = false;
  private initializing = false;

  private readonly onVisibilityChange = (): void => {
    this.updatePlayback();
  };

  private readonly onMotionChange = (): void => {
    this.zone.run(() => {
      this.reducedMotion.set(this.motionQuery.matches);

      if (!this.reducedMotion() && !this.player) {
        void this.initializePlayer();
      }

      this.updatePlayback();
    });
  };

  ngAfterViewInit(): void {
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

  private async initializePlayer(): Promise<void> {
    if (
      this.initializing ||
      this.destroyed ||
      this.reducedMotion() ||
      this.player ||
      this.error()
    ) {
      return;
    }

    this.initializing = true;

    try {
      const { DotLottie } =
        await import('@lottiefiles/dotlottie-web');

      if (this.destroyed || this.reducedMotion()) {
        return;
      }

      DotLottie.setWasmUrl(WASM_URL);

      this.zone.runOutsideAngular(() => {
        const player = new DotLottie({
          canvas: this.canvas.nativeElement,
          src: ANIMATION_URL,
          autoplay: false,
          loop: true
        });

        this.player = player;

        player.addEventListener('load', () => {
          if (this.destroyed) {
            return;
          }

          this.zone.run(() => this.ready.set(true));
          this.updatePlayback();
        });

        player.addEventListener('loadError', () => {
          this.handleError();
        });
      });
    } catch {
      this.handleError();
    } finally {
      this.initializing = false;
    }
  }

  private updatePlayback(): void {
    if (!this.player || !this.ready() || this.destroyed) {
      return;
    }

    if (document.hidden || this.reducedMotion()) {
      this.player.pause();
    } else {
      this.player.play();
    }
  }

  private handleError(): void {
    if (this.destroyed) {
      return;
    }

    this.player?.destroy();
    this.player = null;

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
