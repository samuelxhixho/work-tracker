import {
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import {RouterLink} from '@angular/router';

import {MusicPlayerService} from '../../services/music-player.service';

@Component({
  selector: 'app-music-dock',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './music-dock.html',
  styleUrl: './music-dock.scss'
})
export class MusicDock {
  readonly player = inject(MusicPlayerService);

  @ViewChild('dockPopover')
  private dockPopover?: ElementRef<HTMLDivElement>;

  readonly compactMenuOpen = signal(false);
  readonly compactMenuPosition = signal({left: 8, top: 8});

  readonly progress = computed(() => {
    const duration = this.player.duration();

    if (duration <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, this.player.currentTime() / duration * 100)
    );
  });

  toggleCompactMenu(button: HTMLElement): void {
    const popover = this.dockPopover?.nativeElement;

    if (!popover) {
      return;
    }

    if (popover.matches(':popover-open')) {
      popover.hidePopover();
      return;
    }

    popover.showPopover();

    const trigger = button.getBoundingClientRect();
    const menu = popover.getBoundingClientRect();

    const preferredLeft = trigger.right + 12;
    const left = preferredLeft + menu.width + 8 <= window.innerWidth
      ? preferredLeft
      : trigger.left - menu.width - 12;

    this.compactMenuPosition.set({
      left: Math.max(8, Math.min(left, window.innerWidth - menu.width - 8)),
      top: Math.max(8, Math.min(trigger.top, window.innerHeight - menu.height - 8))
    });
  }

  onCompactMenuToggle(): void {
    this.compactMenuOpen.set(
      this.dockPopover?.nativeElement.matches(':popover-open') ?? false
    );
  }

  closeCompactMenu(): void {
    const popover = this.dockPopover?.nativeElement;

    if (popover?.matches(':popover-open')) {
      popover.hidePopover();
    }
  }

  formatTime(seconds: number): string {
    const total = Number.isFinite(seconds)
      ? Math.max(0, Math.floor(seconds))
      : 0;

    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
