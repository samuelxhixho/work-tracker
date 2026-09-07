import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild
} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

import {MusicTrack} from './models/music-track.model';
import {MusicLibraryService} from './services/music-library.service';

import {MusicPlayerService} from './services/music-player.service';

@Component({
  selector: 'app-chill-room',
  standalone: true,
  templateUrl: './chill-room.html',
  styleUrl: './chill-room.scss'
})
export class ChillRoom implements OnInit {
  private readonly musicLibrary = inject(MusicLibraryService);
  private readonly destroyRef = inject(DestroyRef);
  readonly player = inject(MusicPlayerService);

  @ViewChild('musicFileInput')
  private musicFileInput?: ElementRef<HTMLInputElement>;

  @ViewChild('removeDialog')
  private removeDialog?: ElementRef<HTMLDialogElement>;

  @ViewChild('musicActionsPopover')
  private musicActionsPopover?: ElementRef<HTMLElement>;

  readonly tracks = signal<MusicTrack[]>([]);
  readonly loading = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly trackToRemove = signal<MusicTrack | null>(null);
  readonly deleting = signal(false);
  readonly removeError = signal<string | null>(null);
  readonly musicMenuTrack = signal<MusicTrack | null>(null);
  readonly musicMenuOpen = signal(false);
  readonly musicMenuPosition = signal({left: 8, top: 8});

  ngOnInit(): void {
    this.loadTracks();
  }

  openMusicPicker(): void {
    if (this.loading() || this.uploading() || this.deleting()) {
      return;
    }

    this.musicFileInput?.nativeElement.click();
  }

  onMusicSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    input.value = '';

    if (!file || this.uploading() || this.deleting()) {
      return;
    }

    this.error.set(null);

    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions = ['mp3', 'wav', 'ogg', 'm4a'];

    if (!extension || !supportedExtensions.includes(extension)) {
      this.error.set('Supported formats are MP3, WAV, OGG and M4A.');
      return;
    }

    if (file.size === 0) {
      this.error.set('Choose a non-empty audio file.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      this.error.set('Music files cannot exceed 100 MB.');
      return;
    }

    this.uploading.set(true);

    this.musicLibrary.addTrack(file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.uploading.set(false))
      )
      .subscribe({
        next: () => {
          this.loadTracks();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.getErrorMessage(error));
        }
      });
  }

  loadTracks(): void {
    this.loading.set(true);
    this.error.set(null);

    this.musicLibrary.getTracks()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: tracks => {
          this.tracks.set(tracks);
          this.player.setQueue(tracks);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.getErrorMessage(error));
        }
      });
  }

  formatFileSize(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatTime(seconds: number): string {
    const total = Number.isFinite(seconds)
      ? Math.max(0, Math.floor(seconds))
      : 0;

    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  toggleLibraryMenu(button: HTMLElement): void {
    const popover = this.musicActionsPopover?.nativeElement;

    if (popover?.matches(':popover-open')) {
      popover.hidePopover();
      return;
    }

    const selected = this.player.track();

    if (!selected) {
      return;
    }

    const rect = button.getBoundingClientRect();

    this.showMusicMenu(
      selected,
      rect.right - 220,
      rect.bottom + 8
    );
  }

  openTrackMenu(event: MouseEvent, track: MusicTrack): void {
    event.preventDefault();

    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    const keyboardPosition =
      event.clientX === 0 && event.clientY === 0;

    this.showMusicMenu(
      track,
      keyboardPosition ? rect.left + 12 : event.clientX,
      keyboardPosition ? rect.bottom : event.clientY
    );
  }

  closeMusicMenu(): void {
    const popover = this.musicActionsPopover?.nativeElement;

    if (popover?.matches(':popover-open')) {
      popover.hidePopover();
    }
  }

  onMusicMenuToggle(): void {
    this.musicMenuOpen.set(
      this.musicActionsPopover?.nativeElement.matches(':popover-open')
      ?? false
    );
  }

  removeFromMusicMenu(): void {
    const track = this.musicMenuTrack();

    if (!track) {
      return;
    }

    this.closeMusicMenu();
    this.openRemoveConfirmation(track);
  }

  private showMusicMenu(
    track: MusicTrack,
    x: number,
    y: number
  ): void {
    if (this.loading() || this.uploading() || this.deleting()) {
      return;
    }

    const popover = this.musicActionsPopover?.nativeElement;

    if (!popover) {
      return;
    }

    const left = Math.max(
      8,
      Math.min(x, window.innerWidth - 228)
    );

    const top = Math.max(
      8,
      Math.min(y, window.innerHeight - 108)
    );

    this.musicMenuTrack.set(track);
    this.musicMenuPosition.set({left, top});

    if (!popover.matches(':popover-open')) {
      popover.showPopover();
    }
  }

  openRemoveConfirmation(track: MusicTrack): void {
    if (this.loading() || this.uploading() || this.deleting()) {
      return;
    }

    this.trackToRemove.set(track);
    this.removeError.set(null);

    const dialog = this.removeDialog?.nativeElement;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  closeRemoveConfirmation(): void {
    if (this.deleting()) {
      return;
    }

    this.removeDialog?.nativeElement.close();
  }

  onRemoveDialogCancel(event: Event): void {
    if (this.deleting()) {
      event.preventDefault();
    }
  }

  onRemoveDialogClosed(): void {
    this.trackToRemove.set(null);
    this.removeError.set(null);
  }

  confirmRemoveTrack(): void {
    const track = this.trackToRemove();

    if (!track || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.removeError.set(null);

    this.musicLibrary.removeTrack(track.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deleting.set(false))
      )
      .subscribe({
        next: () => {
          if (this.player.track()?.id === track.id) {
            this.player.clearTrack();
          }

          const remainingTracks = this.tracks().filter(
            item => item.id !== track.id
          );

          this.tracks.set(remainingTracks);
          this.player.setQueue(remainingTracks);

          this.removeDialog?.nativeElement.close();
        },
        error: (error: HttpErrorResponse) => {
          this.removeError.set(this.getErrorMessage(error));
        }
      });
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Could not connect to WorkTracker. Please try again.';
    }

    const detail = error.error?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (error.status === 413) {
      return 'The selected file is too large.';
    }

    return 'Something went wrong. Please try again.';
  }
}
