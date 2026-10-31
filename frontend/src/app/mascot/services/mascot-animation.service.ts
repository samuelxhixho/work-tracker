import { Injectable, computed, signal } from '@angular/core';

export type MascotAnimationState = 'idle' | 'thinking';

@Injectable({
  providedIn: 'root'
})
export class MascotAnimationService {
  private readonly activeThinkingCount = signal(0);

  readonly state = computed<MascotAnimationState>(() =>
    this.activeThinkingCount() > 0 ? 'thinking' : 'idle'
  );

  beginThinking(): () => void {
    this.activeThinkingCount.update(count => count + 1);

    let finished = false;

    return () => {
      if (finished) {
        return;
      }

      finished = true;
      this.activeThinkingCount.update(count => Math.max(0, count - 1));
    };
  }
}
