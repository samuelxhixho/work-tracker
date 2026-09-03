import {inject, Injectable} from '@angular/core';

import {HttpClient, HttpParams} from '@angular/common/http';

import {Observable} from 'rxjs';

import {WeeklyReport} from '../../reports/weekly-report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    '/api/reports';

  getWeeklyReport(
    date: string
  ): Observable<WeeklyReport> {
    const params = new HttpParams()
      .set('date', date);

    return this.http.get<WeeklyReport>(
      `${this.apiUrl}/weekly`,
      {params}
    );
  }
}
