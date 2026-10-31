package com.worktracker.task;

import com.worktracker.task.dto.CreateTaskRequest;
import com.worktracker.task.dto.BatchCreateTasksRequest;
import com.worktracker.task.dto.TaskResponse;
import com.worktracker.task.dto.UpdateTaskRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@Valid @RequestBody CreateTaskRequest request) {
        return taskService.create(request);
    }

    @GetMapping
    public List<TaskResponse> getTasks(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to
    ) {
        if (from != null && to != null) {
            return taskService.getByDateRange(from, to);
        }

        return taskService.getAll();
    }

    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TaskResponse> createBatch(
            @Valid @RequestBody BatchCreateTasksRequest request
    ) {
        return taskService.createBatch(request.tasks());
    }

    @PutMapping("/{id}")
    public TaskResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTaskRequest request
    ) {
        return taskService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        taskService.delete(id);
    }
}