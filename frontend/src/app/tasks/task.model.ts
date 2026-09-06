export type TaskCategory =
  | 'FRONTEND'
  | 'BACKEND'
  | 'DEVOPS'
  | 'TESTING'
  | 'MEETING'
  | 'OTHER';

export type TaskStatus =
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'BLOCKED';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  workDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  workDate: string;
}

export interface BatchCreateTasksRequest {
  tasks: CreateTaskRequest[];
}

export interface UpdateTaskRequest {
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  workDate: string;
}
