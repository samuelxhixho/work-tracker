package com.worktracker.ai;

import com.worktracker.chillroom.MusicTrack;
import com.worktracker.chillroom.MusicTrackRepository;
import com.worktracker.settings.SettingsService;
import com.worktracker.settings.dto.SettingsResponse;
import com.worktracker.task.Task;
import com.worktracker.task.TaskCategory;
import com.worktracker.task.TaskRepository;
import com.worktracker.task.TaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
public class LocalAiLookupService {

    private static final int TASK_LIMIT = 12;
    private static final int MUSIC_LIMIT = 15;


    private final TaskRepository tasks;
    private final SettingsService settings;
    private final MusicTrackRepository music;

    public LocalAiLookupService(TaskRepository tasks, SettingsService settings, MusicTrackRepository music) {
        this.tasks = tasks;
        this.settings = settings;
        this.music = music;
    }

    @Transactional(readOnly = true)
    public Lookup lookup(
            LocalAiIntent intent,
            LocalAiController.PlayerState player
    ) {
        ZonedDateTime now = ZonedDateTime.now();

        boolean taskSearch =
                intent.kind() == LocalAiIntent.Kind.TASK_SEARCH
                        || intent.kind() == LocalAiIntent.Kind.WORK_OVERVIEW;

        Period period = intent.fromDate() == null
                ? null
                : new Period(
                intent.fromDate(),
                intent.toDate(),
                intent.fromDate() + " to " + intent.toDate() + " inclusive"
        );

        TaskMatches matches = taskSearch
                ? findTasks(
                period,
                intent.status(),
                intent.category(),
                intent.keywords(),
                intent.questId(),
                intent.categoryBreakdown()
        )
                : null;

        EarliestSavedWork earliest = null;

        if (intent.kind() == LocalAiIntent.Kind.EARLIEST_WORK) {
            earliest = tasks.findFirstByOrderByWorkDateAscIdAsc()
                    .map(task -> new EarliestSavedWork(
                            task.getWorkDate().toString(),
                            task.getId(),
                            shorten(task.getTitle(), 160)
                    ))
                    .orElse(new EarliestSavedWork(null, null, null));
        }

        boolean musicRequested = intent.kind() == LocalAiIntent.Kind.MUSIC;
        boolean settingsRequested = intent.kind() == LocalAiIntent.Kind.SETTINGS;

        return new Lookup(
                now.toString(),
                matches,
                earliest,
                settingsRequested ? settings.getSettings() : null,
                musicRequested ? findMusic() : null,
                musicRequested ? player : null,
                "All queries are read-only. Work dates are not completion timestamps. "
                        + "Matching counts cover all results, but task details are limited. "
                        + "No result outside the requested scope should be inferred."
        );
    }

    private TaskMatches findTasks(
            Period period, TaskStatus status, TaskCategory category,
            String keywords, Long taskId, boolean includeCategoryCounts
    ) {
        List<String> terms = keywords == null ? List.of() : Arrays.stream(keywords.split("\\s+"))
                .filter(term -> !term.isBlank())
                .limit(4)
                .toList();

        Specification<Task> criteria = specification(period, status, category, terms, taskId);
        Page<Task> page = tasks.findAll(criteria,
                PageRequest.of(0, TASK_LIMIT, Sort.by(Sort.Order.desc("workDate"), Sort.Order.desc("id"))));

        return new TaskMatches(
                period == null ? "All saved work dates" : period.label(),
                period == null ? null : period.from().toString(),
                period == null ? null : period.to().toString(),
                status == null ? null : status.name(),
                category == null ? null : category.name(),
                keywords,
                taskId,
                page.getTotalElements(),
                countForStatus(period, status, category, terms, taskId, TaskStatus.COMPLETED, page.getTotalElements()),
                countForStatus(period, status, category, terms, taskId, TaskStatus.IN_PROGRESS, page.getTotalElements()),
                countForStatus(period, status, category, terms, taskId, TaskStatus.BLOCKED, page.getTotalElements()),
                includeCategoryCounts ? Arrays.stream(TaskCategory.values())
                        .map(value -> new CategoryCount(value.name(),
                                countForCategory(period, status, category, terms, taskId, value, page.getTotalElements())))
                        .toList() : null,
                page.getTotalElements() > page.getNumberOfElements(),
                page.getContent().stream().map(this::taskDetail).toList(),
                keywords == null ? null : "Literal title/description term matching; semantic paraphrases may not match."
        );
    }

    private long countForStatus(
            Period period, TaskStatus status, TaskCategory category, List<String> terms,
            Long taskId, TaskStatus target, long total
    ) {
        if (status != null) return status == target ? total : 0;
        return tasks.count(specification(period, target, category, terms, taskId));
    }

    private long countForCategory(
            Period period, TaskStatus status, TaskCategory category, List<String> terms,
            Long taskId, TaskCategory target, long total
    ) {
        if (category != null) return category == target ? total : 0;
        return tasks.count(specification(period, status, target, terms, taskId));
    }

    private Specification<Task> specification(
            Period period, TaskStatus status, TaskCategory category,
            List<String> terms, Long taskId
    ) {
        return (root, _, cb) -> {
            List<Predicate> conditions = new ArrayList<>();
            if (taskId != null) conditions.add(cb.equal(root.get("id"), taskId));
            if (period != null) {
                conditions.add(cb.between(root.get("workDate"), period.from(), period.to()));
            }
            if (status != null) {
                conditions.add(cb.equal(root.get("status"), status));
            }
            if (category != null) {
                conditions.add(cb.equal(root.get("category"), category));
            }
            for (String term : terms) {
                String fragment = "%" + escapeLike(term.toLowerCase(Locale.ROOT)) + "%";
                conditions.add(cb.or(
                        cb.like(cb.lower(root.get("title")), fragment, '\\'),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), fragment, '\\')
                ));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        };
    }

    private String escapeLike(String term) {
        return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private TaskDetail taskDetail(Task task) {
        String title = task.getTitle() == null ? "" : task.getTitle();
        String description = task.getDescription() == null ? "" : task.getDescription();
        return new TaskDetail(task.getId(), shorten(title, 160), shorten(description, 340),
                title.length() > 160 || description.length() > 340,
                task.getCategory().name(), task.getStatus().name(), task.getWorkDate().toString(),
                task.getCreatedAt() == null ? null : task.getCreatedAt().toString(),
                task.getUpdatedAt() == null ? null : task.getUpdatedAt().toString());
    }

    private MusicLibrary findMusic() {
        Page<MusicTrack> page = music.findAll(PageRequest.of(0, MUSIC_LIMIT,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new MusicLibrary(page.getTotalElements(), page.hasNext(),
                page.getContent().stream().map(track -> new MusicDetail(
                        track.getId(), shorten(track.getTitle(), 140), shorten(track.getArtist(), 100)
                )).toList());
    }

    private String shorten(String value, int length) {
        if (value == null) return "";
        return value.length() > length ? value.substring(0, length) + "..." : value;
    }

    private record Period(LocalDate from, LocalDate to, String label) { }

    public record Lookup(
            String capturedAt,
            TaskMatches matchingSavedTasks,
            EarliestSavedWork earliestSavedWork,
            SettingsResponse savedSettings,
            MusicLibrary savedMusicLibrary,
            LocalAiController.PlayerState frontendMusicPlayback,
            String limitations
    ) { }

    public record EarliestSavedWork(
            String workDate,
            Long questId,
            String title
    ) { }

    public record TaskMatches(
            String scope,
            String fromInclusive,
            String toInclusive,
            String statusFilter,
            String categoryFilter,
            String literalSearchTerms,
            Long exactTaskId,
            long totalMatching,
            long completedMatching,
            long inProgressMatching,
            long blockedMatching,
            List<CategoryCount> categoryBreakdown,
            boolean detailsLimited,
            List<TaskDetail> tasks,
            String matchingNote
    ) { }

    public record TaskDetail(
            Long id, String title, String description, boolean textShortened,
            String category, String status, String workDate,
            String createdAt, String updatedAt
    ) { }

    public record CategoryCount(String category, long count) { }

    public record MusicLibrary(long totalTracks, boolean detailsLimited, List<MusicDetail> tracks) { }
    public record MusicDetail(Long id, String title, String artist) { }
}
