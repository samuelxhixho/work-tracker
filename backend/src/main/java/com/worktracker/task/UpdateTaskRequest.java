package com.worktracker.task.dto;

import com.worktracker.task.TaskCategory;
import com.worktracker.task.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateTaskRequest(
        @NotBlank
        @Size(max = 200)
        String title,

        String description,

        @NotNull
        TaskCategory category,

        @NotNull
        TaskStatus status,

        @NotNull
        LocalDate workDate
) {
}