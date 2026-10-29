import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LocalAiAvailability {
  status: 'AVAILABLE' | 'MODEL_MISSING' | 'UNAVAILABLE' | 'INVALID_RESPONSE';
  model: string;
  message: string;
}

export interface LocalAiSummary {
  summary: string;
  model: string;
}

export interface LocalAiCancellation {
  cancelled: boolean;
}

export interface LocalAiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LocalAiPlayerState {
  trackTitle: string | null;
  artist: string | null;
  playing: boolean;
  loading: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}

export interface LocalAiChatReply {
  reply: string;
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocalAiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/ai';

  checkAvailability(): Observable<LocalAiAvailability> {
    return this.http.get<LocalAiAvailability>(
      `${this.baseUrl}/availability`
    );
  }

  summarize(
    requestId: string,
    notes: string
  ): Observable<LocalAiSummary> {
    return this.http.post<LocalAiSummary>(
      `${this.baseUrl}/summary`,
      { requestId, notes }
    );
  }

  chat(
    requestId: string,
    messages: LocalAiChatMessage[],
    currentPage: string,
    playerState: LocalAiPlayerState
  ): Observable<LocalAiChatReply> {
    return this.http.post<LocalAiChatReply>(
      `${this.baseUrl}/chat`,
      { requestId, messages, currentPage, playerState }
    );
  }

  cancel(requestId: string): Observable<LocalAiCancellation> {
    return this.http.post<LocalAiCancellation>(
      `${this.baseUrl}/requests/${encodeURIComponent(requestId)}/cancel`,
      {}
    );
  }
}
