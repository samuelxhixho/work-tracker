package com.worktracker.ai;

import com.worktracker.task.TaskCategory;
import com.worktracker.task.TaskStatus;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;

public record LocalAiIntent(
        Kind kind,
        LocalDate fromDate,
        LocalDate toDate,
        TaskStatus status,
        TaskCategory category,
        String keywords,
        Long questId,
        boolean categoryBreakdown,
        ListOrder listOrder,
        Integer listLimit,
        Integer listPage,
        Integer listOffset
) {
    public enum Kind {
        GREETING,
        OFF_TOPIC,
        TASK_SEARCH,
        TASK_LIST,
        TASK_LIST_CONTINUE,
        EARLIEST_WORK,
        LATEST_WORK,
        WORK_OVERVIEW,
        SETTINGS,
        MUSIC,
        APP_HELP,
        UNKNOWN,
    }

    public enum ListOrder {
        OLDEST_FIRST,
        NEWEST_FIRST
    }
    public LocalAiIntent {
        if (kind == null) {
            throw new IllegalArgumentException("Intent kind is required.");
        }

        if ((fromDate == null) != (toDate == null)) {
            throw new IllegalArgumentException("Both date boundaries are required.");
        }

        if (fromDate != null && toDate.isBefore(fromDate)) {
            throw new IllegalArgumentException("Invalid date range.");
        }

        if (questId != null && questId <= 0) {
            throw new IllegalArgumentException("Invalid Quest ID.");
        }

        if (keywords != null) {
            keywords = keywords.strip();

            if (keywords.length() > 100) {
                throw new IllegalArgumentException("Search keywords are too long.");
            }

            if (keywords.isBlank()) {
                keywords = null;
            }
        }
        if (kind == Kind.TASK_LIST) {
            if (listOrder == null) {
                listOrder = ListOrder.NEWEST_FIRST;
            }

            if (listLimit == null) {
                listLimit = 10;
            }

            if (listPage == null) {
                listPage = 0;
            }

            if (listOffset == null) {
                listOffset = listPage * listLimit;
            }

            if (listOffset < 0 || listOffset > 20_000) {
                throw new IllegalArgumentException("Invalid list offset.");
            }

            if (listLimit < 1 || listLimit > 20) {
                throw new IllegalArgumentException("List limit must be between 1 and 20.");
            }

            if (listPage < 0 || listPage > 1000) {
                throw new IllegalArgumentException("Invalid list page.");
            }
        }

        if (kind == Kind.TASK_LIST_CONTINUE
                && listLimit != null
                && (listLimit < 1 || listLimit > 20)) {
            throw new IllegalArgumentException(
                    "Continuation limit must be between 1 and 20."
            );
        }
    }

    public static LocalAiIntent fromJson(JsonNode root) {
        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("Invalid AI intent.");
        }

        Kind kind = enumValue(root, "kind", Kind.class);

        return new LocalAiIntent(
                kind,
                dateValue(root, "fromDate"),
                dateValue(root, "toDate"),
                enumValue(root, "status", TaskStatus.class),
                enumValue(root, "category", TaskCategory.class),
                textValue(root, "keywords"),
                idValue(root, "questId"),
                root.path("categoryBreakdown").asBoolean(false),
                enumValue(root, "listOrder", ListOrder.class),
                integerValue(root, "listLimit"),
                integerValue(root, "listPage"),
                integerValue(root, "listOffset")
        );
    }

    private static String textValue(JsonNode root, String field) {
        JsonNode value = root.path(field);

        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (!value.isTextual()) {
            throw new IllegalArgumentException("Invalid field: " + field);
        }

        return value.asText();
    }

    private static LocalDate dateValue(JsonNode root, String field) {
        String value = textValue(root, field);

        if (value == null) {
            return null;
        }

        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("Invalid date: " + field);
        }
    }

    private static Integer integerValue(JsonNode root, String field) {
        JsonNode value = root.path(field);

        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (!value.isIntegralNumber()) {
            throw new IllegalArgumentException("Invalid integer: " + field);
        }

        try {
            return Integer.parseInt(value.asString());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid integer: " + field);
        }
    }

    private static Long idValue(JsonNode root, String field) {
        JsonNode value = root.path(field);

        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (!value.isIntegralNumber()) {
            throw new IllegalArgumentException("Invalid Quest ID.");
        }

        try {
            return Long.parseLong(value.asText());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid Quest ID.");
        }
    }

    private static <T extends Enum<T>> T enumValue(
            JsonNode root,
            String field,
            Class<T> type
    ) {
        String value = textValue(root, field);

        if (value == null) {
            return null;
        }

        try {
            String normalized = value.strip()
                    .toUpperCase(Locale.ROOT)
                    .replace('-', '_')
                    .replace(' ', '_');

            return Enum.valueOf(type, normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unsupported value: " + field);
        }
    }
}