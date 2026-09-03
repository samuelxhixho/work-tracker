package com.worktracker.report;

import com.worktracker.task.Task;
import com.worktracker.task.TaskCategory;
import com.worktracker.task.TaskRepository;
import com.worktracker.task.TaskStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Arrays;
import java.util.List;

@Service
public class ReportService {

    private final TaskRepository taskRepository;

    public ReportService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public WeeklyReportResponse generateWeeklyReport(LocalDate date) {
        LocalDate weekStart = date.with(
                TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)
        );

        LocalDate weekEnd = date.with(
                TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)
        );

        List<Task> tasks =
                taskRepository.findByWorkDateBetweenOrderByWorkDateAsc(
                        weekStart,
                        weekEnd
                );

        int completedTasks = countByStatus(tasks, TaskStatus.COMPLETED);
        int inProgressTasks = countByStatus(tasks, TaskStatus.IN_PROGRESS);
        int blockedTasks = countByStatus(tasks, TaskStatus.BLOCKED);

        String markdown = buildMarkdown(tasks, weekStart, weekEnd);

        return new WeeklyReportResponse(
                weekStart,
                weekEnd,
                tasks.size(),
                completedTasks,
                inProgressTasks,
                blockedTasks,
                markdown
        );
    }

    private int countByStatus(List<Task> tasks, TaskStatus status) {
        return (int) tasks.stream()
                .filter(task -> task.getStatus() == status)
                .count();
    }

    private String buildMarkdown(
            List<Task> tasks,
            LocalDate weekStart,
            LocalDate weekEnd
    ) {
        StringBuilder markdown = new StringBuilder();

        markdown.append("# Weekly Report\n\n");
        markdown.append("**")
                .append(weekStart)
                .append(" - ")
                .append(weekEnd)
                .append("**\n\n");

        Arrays.stream(TaskCategory.values())
                .forEach(category -> appendCategory(
                        markdown,
                        tasks,
                        category
                ));

        return markdown.toString().trim();
    }

    private void appendCategory(
            StringBuilder markdown,
            List<Task> tasks,
            TaskCategory category
    ) {
        List<Task> categoryTasks = tasks.stream()
                .filter(task -> task.getCategory() == category)
                .toList();

        if (categoryTasks.isEmpty()) {
            return;
        }

        markdown.append("## ")
                .append(formatCategory(category))
                .append("\n\n");

        categoryTasks.forEach(task -> markdown
                .append("- ")
                .append(task.getTitle())
                .append(" — ")
                .append(formatStatus(task.getStatus()))
                .append("\n"));

        markdown.append("\n");
    }

    private String formatCategory(TaskCategory category) {
        return switch (category) {
            case FRONTEND -> "Frontend";
            case BACKEND -> "Backend";
            case DEVOPS -> "DevOps";
            case TESTING -> "Testing";
            case MEETING -> "Meetings";
            case OTHER -> "Other";
        };
    }

    private String formatStatus(TaskStatus status) {
        return switch (status) {
            case COMPLETED -> "Completed";
            case IN_PROGRESS -> "In Progress";
            case BLOCKED -> "Blocked";
        };
    }
}