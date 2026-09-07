import {Injectable, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MusicSessionService {
  private readonly selected = signal(false);

  readonly hasTrack = this.selected.asReadonly();

  setHasTrack(value: boolean): void {
    this.selected.set(value);
  }
}
