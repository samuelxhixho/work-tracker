package com.worktracker.task;

import com.worktracker.task.dto.CreateTaskRequest;
import com.worktracker.task.dto.TaskResponse;
import com.worktracker.task.dto.UpdateTaskRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional
    public TaskResponse create(CreateTaskRequest request) {
        Task task = new Task();

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setCategory(request.category());
        task.setStatus(request.status());
        task.setWorkDate(request.workDate());

        Task savedTask = taskRepository.save(task);

        return toResponse(savedTask);
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getAll() {
        return taskRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getByDateRange(LocalDate from, LocalDate to) {
        return taskRepository.findByWorkDateBetweenOrderByWorkDateAsc(from, to)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TaskResponse update(Long id, UpdateTaskRequest request) {
        Task task = findById(id);

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setCategory(request.category());
        task.setStatus(request.status());
        task.setWorkDate(request.workDate());

        taskRepository.flush();

        return toResponse(task);
    }

    @Transactional
    public void delete(Long id) {
        Task task = findById(id);
        taskRepository.delete(task);
    }

    private Task findById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Task not found"
                ));
    }

    private TaskResponse toResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getCategory(),
                task.getStatus(),
                task.getWorkDate(),
                task.getCreatedAt(),
                task.getUpdatedAt()
        );
    }
}