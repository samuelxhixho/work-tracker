import {HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';

import {MusicTrack} from '../models/music-track.model';

@Injectable({
  providedIn: 'root'
})
export class MusicLibraryService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    '/api/chill-room/music';

  getTracks(): Observable<MusicTrack[]> {
    return this.http.get<MusicTrack[]>(this.apiUrl);
  }

  addTrack(file: File): Observable<MusicTrack> {
    const formData = new FormData();

    formData.append(
      'file',
      file,
      file.name
    );

    return this.http.post<MusicTrack>(
      this.apiUrl,
      formData
    );
  }

  getStreamUrl(id: number): string {
    return `${this.apiUrl}/${id}/stream`;
  }

  removeTrack(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
