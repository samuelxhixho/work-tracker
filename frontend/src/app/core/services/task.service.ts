import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';

import {
  BatchCreateTasksRequest,
  CreateTaskRequest,
  Task,
  UpdateTaskRequest
} from '../../tasks/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    '/api/tasks';

  getAllTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  getTasks(from: string, to: string): Observable<Task[]> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to);

    return this.http.get<Task[]>(this.apiUrl, {params});
  }

  createTask(request: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, request);
  }

  createTasksBatch(
    request: BatchCreateTasksRequest
  ): Observable<Task[]> {
    return this.http.post<Task[]>(
      `${this.apiUrl}/batch`,
      request
    );
  }

  updateTask(
    id: number,
    request: UpdateTaskRequest
  ): Observable<Task> {
    return this.http.put<Task>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }
}
