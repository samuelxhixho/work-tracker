package com.worktracker.report;

import java.time.LocalDate;

public record WeeklyReportResponse(
        LocalDate weekStart,
        LocalDate weekEnd,
        int totalTasks,
        int completedTasks,
        int inProgressTasks,
        int blockedTasks,
        String markdown
) {
}