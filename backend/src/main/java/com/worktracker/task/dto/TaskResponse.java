package com.worktracker.task.dto;

import com.worktracker.task.TaskCategory;
import com.worktracker.task.TaskStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TaskResponse(
        Long id,
        String title,
        String description,
        TaskCategory category,
        TaskStatus status,
        LocalDate workDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}