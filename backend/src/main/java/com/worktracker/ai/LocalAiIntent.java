package com.worktracker.ai;

import com.worktracker.task.TaskCategory;
import com.worktracker.task.TaskStatus;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

public record LocalAiIntent(
        Kind kind,
        LocalDate fromDate,
        LocalDate toDate,
        TaskStatus status,
        TaskCategory category,
        String keywords,
        Long questId,
        boolean categoryBreakdown
) {
    public enum Kind {
        GREETING,
        OFF_TOPIC,
        TASK_SEARCH,
        EARLIEST_WORK,
        WORK_OVERVIEW,
        SETTINGS,
        MUSIC,
        APP_HELP,
        UNKNOWN
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
                root.path("categoryBreakdown").asBoolean(false)
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
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unsupported value: " + field);
        }
    }
}