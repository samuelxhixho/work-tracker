export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  markdown: string;
}
