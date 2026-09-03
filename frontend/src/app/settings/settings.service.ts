import {inject, Injectable} from '@angular/core';

import {HttpClient} from '@angular/common/http';

import {Observable} from 'rxjs';

import {AppSettings, UpdateSettingsRequest} from './settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly http =
    inject(HttpClient);

  private readonly apiUrl =
    '/api/settings';

  getSettings():
    Observable<AppSettings> {
    return this.http.get<AppSettings>(
      this.apiUrl
    );
  }

  updateSettings(
    request: UpdateSettingsRequest
  ): Observable<AppSettings> {
    return this.http.put<AppSettings>(
      this.apiUrl,
      request
    );
  }
}
