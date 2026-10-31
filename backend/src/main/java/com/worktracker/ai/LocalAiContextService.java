package com.worktracker.ai;

import com.worktracker.task.Task;
import com.worktracker.task.TaskRepository;
import com.worktracker.task.TaskStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;

@Service
public class LocalAiContextService {

    private static final Map<String, String> PAGES = Map.of(
            "/", "Home",
            "/quests", "Quests",
            "/weekly-log", "Weekly Log",
            "/history", "History",
            "/settings", "Settings",
            "/chill-room", "Chill Room"
    );

    private final TaskRepository taskRepository;

    public LocalAiContextService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public Snapshot snapshot(String currentPage) {
        ZonedDateTime now = ZonedDateTime.now();
        LocalDate today = now.toLocalDate();
        LocalDate weekStart = today.with(
                TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)
        );
        LocalDate weekEnd = weekStart.plusDays(6);

        long blockedCount = taskRepository.countByStatus(TaskStatus.BLOCKED);

        List<TaskDetail> blocked = taskRepository
                .findTop4ByStatusOrderByWorkDateDescIdDesc(TaskStatus.BLOCKED)
                .stream()
                .map(this::detail)
                .toList();

        return new Snapshot(
                now.toString(),
                today.toString(),
                now.getZone().getId(),
                currentPage == null
                        ? "Unknown"
                        : PAGES.getOrDefault(currentPage, "Unknown"),
                taskRepository.count(),
                new BlockedSection(
                        "All work dates; current status is BLOCKED",
                        blockedCount,
                        blockedCount > blocked.size(),
                        blocked
                ),
                period(today, today),
                period(weekStart, weekEnd)
        );
    }

    private PeriodSection period(LocalDate from, LocalDate to) {
        long completed = taskRepository.countByWorkDateBetweenAndStatus(
                from, to, TaskStatus.COMPLETED
        );
        long inProgress = taskRepository.countByWorkDateBetweenAndStatus(
                from, to, TaskStatus.IN_PROGRESS
        );
        long blocked = taskRepository.countByWorkDateBetweenAndStatus(
                from, to, TaskStatus.BLOCKED
        );

        List<TaskDetail> details = taskRepository
                .findTop4ByWorkDateBetweenOrderByWorkDateDescIdDesc(from, to)
                .stream()
                .map(this::detail)
                .toList();

        long total = completed + inProgress + blocked;

        return new PeriodSection(
                from.toString(),
                to.toString(),
                total,
                completed,
                inProgress,
                blocked,
                total > details.size(),
                details
        );
    }

    private TaskDetail detail(Task task) {
        String title = task.getTitle() == null ? "" : task.getTitle();
        String description = task.getDescription() == null
                ? ""
                : task.getDescription();

        return new TaskDetail(
                task.getId(),
                clip(title, 120),
                clip(description, 160),
                title.length() > 120 || description.length() > 160,
                task.getCategory().name(),
                task.getStatus().name(),
                task.getWorkDate().toString()
        );
    }

    private String clip(String value, int limit) {
        return value.length() <= limit
                ? value
                : value.substring(0, limit) + "...";
    }

    public record Snapshot(
            String capturedAt,
            String today,
            String timeZone,
            String currentPage,
            long totalSavedTasks,
            BlockedSection blocked,
            PeriodSection todayWork,
            PeriodSection thisWeekWork
    ) {
    }

    public record BlockedSection(
            String scope,
            long total,
            boolean detailsLimited,
            List<TaskDetail> tasks
    ) {
    }

    public record PeriodSection(
            String fromInclusive,
            String toInclusive,
            long total,
            long completed,
            long inProgress,
            long blocked,
            boolean detailsLimited,
            List<TaskDetail> tasks
    ) {
    }

    public record TaskDetail(
            Long id,
            String title,
            String description,
            boolean textShortened,
            String category,
            String status,
            String workDate
    ) {
    }
}