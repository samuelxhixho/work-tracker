package com.worktracker.task.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BatchCreateTasksRequest(
        @NotEmpty
        @Valid
        List<CreateTaskRequest> tasks
) {
}