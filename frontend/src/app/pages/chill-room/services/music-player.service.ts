import {computed, inject, Injectable, OnDestroy, signal} from '@angular/core';

import {MusicTrack} from '../models/music-track.model';
import {MusicLibraryService} from './music-library.service';
import {MusicSessionService} from './music-session.service';

@Injectable({
  providedIn: 'root'
})
export class MusicPlayerService implements OnDestroy {
  readonly track = signal<MusicTrack | null>(null);
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(70);
  readonly error = signal<string | null>(null);

  readonly queue = signal<MusicTrack[]>([]);

  readonly canGoPrevious = computed(
    () => this.track() !== null
  );

  readonly canGoNext = computed(() => {
    const selected = this.track();
    const tracks = this.queue();

    if (!selected) {
      return false;
    }

    const index = tracks.findIndex(
      track => track.id === selected.id
    );

    return index >= 0 && index < tracks.length - 1;
  });

  private readonly musicSession = inject(MusicSessionService);
  private audio: HTMLAudioElement | null = null;
  private readonly listeners = new AbortController();
  private requestId = 0;

  constructor(
    private readonly musicLibrary: MusicLibraryService
  ) {}

  setQueue(tracks: MusicTrack[]): void {
    this.queue.set([...tracks]);
  }

  previousTrack(): void {
    const selected = this.track();

    if (!selected) {
      return;
    }

    if (this.currentTime() > 3) {
      this.seek(0);
      return;
    }

    const tracks = this.queue();
    const index = tracks.findIndex(
      track => track.id === selected.id
    );

    if (index > 0) {
      this.playTrack(tracks[index - 1]);
    } else {
      this.seek(0);
    }
  }

  nextTrack(): void {
    const selected = this.track();

    if (!selected) {
      return;
    }

    const tracks = this.queue();
    const index = tracks.findIndex(
      track => track.id === selected.id
    );

    if (index >= 0 && index < tracks.length - 1) {
      this.playTrack(tracks[index + 1]);
    }
  }

  playTrack(track: MusicTrack): void {
    if (this.track()?.id === track.id) {
      this.togglePlayback();
      return;
    }

    const audio = this.getAudio();

    this.requestId++;
    audio.pause();

    this.track.set(track);
    this.musicSession.setHasTrack(true);
    this.playing.set(false);
    this.loading.set(true);
    this.currentTime.set(0);
    this.duration.set(0);
    this.error.set(null);

    audio.src = this.musicLibrary.getStreamUrl(track.id);
    audio.load();

    this.startPlayback();
  }

  togglePlayback(): void {
    if (!this.audio || !this.track()) {
      return;
    }

    if (this.audio.paused) {
      this.startPlayback();
    } else {
      this.requestId++;
      this.audio.pause();
      this.playing.set(false);
      this.loading.set(false);
    }
  }

  clearTrack(): void {
    this.requestId++;

    this.track.set(null);
    this.musicSession.setHasTrack(false);
    this.playing.set(false);
    this.loading.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.error.set(null);

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  seek(seconds: number): void {
    if (
      !this.audio ||
      !Number.isFinite(seconds) ||
      this.duration() <= 0
    ) {
      return;
    }

    const position = Math.max(
      0,
      Math.min(seconds, this.duration())
    );

    this.audio.currentTime = position;
    this.currentTime.set(position);
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    const volume = Math.max(0, Math.min(100, value));

    this.volume.set(volume);

    if (this.audio) {
      this.audio.volume = volume / 100;
    }
  }

  ngOnDestroy(): void {
    this.requestId++;
    this.musicSession.setHasTrack(false);
    this.listeners.abort();

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
  }

  private getAudio(): HTMLAudioElement {
    if (this.audio) {
      return this.audio;
    }

    const audio = new Audio();

    audio.preload = 'none';
    audio.volume = this.volume() / 100;

    const options = {
      signal: this.listeners.signal
    };

    audio.addEventListener('playing', () => {
      this.playing.set(true);
      this.loading.set(false);
      this.error.set(null);
    }, options);

    audio.addEventListener('pause', () => {
      this.playing.set(false);
    }, options);

    audio.addEventListener('waiting', () => {
      if (this.track()) {
        this.loading.set(true);
      }
    }, options);

    audio.addEventListener('timeupdate', () => {
      this.currentTime.set(audio.currentTime);
    }, options);

    audio.addEventListener('durationchange', () => {
      this.duration.set(
        Number.isFinite(audio.duration)
          ? audio.duration
          : 0
      );
    }, options);

    audio.addEventListener('ended', () => {
      this.playing.set(false);
      this.loading.set(false);

      if (this.canGoNext()) {
        this.nextTrack();
      }
    }, options);

    audio.addEventListener('error', () => {
      this.playing.set(false);
      this.loading.set(false);
      this.error.set(
        'This audio file could not be played. Check that the format is supported.'
      );
    }, options);

    this.audio = audio;

    return audio;
  }

  private startPlayback(): void {
    if (!this.audio) {
      return;
    }

    const audio = this.audio;
    const requestId = ++this.requestId;

    this.loading.set(true);
    this.error.set(null);

    void audio.play().catch((error: unknown) => {
      if (requestId !== this.requestId) {
        return;
      }

      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return;
      }

      this.playing.set(false);
      this.loading.set(false);
      this.error.set(
        'Playback could not start. Try another audio file.'
      );
    });
  }
}
