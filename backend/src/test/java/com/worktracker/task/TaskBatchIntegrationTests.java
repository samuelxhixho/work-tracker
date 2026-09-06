package com.worktracker.task;

import com.worktracker.task.dto.CreateTaskRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.worktracker.task.dto.BatchCreateTasksRequest;
import jakarta.validation.Validator;

@SpringBootTest
@ActiveProfiles("test")
class TaskBatchIntegrationTests {

    @Autowired
    private TaskService taskService;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private Validator validator;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
    }

    @Test
    void createsAllTasksInBatch() {
        CreateTaskRequest first =
                new CreateTaskRequest(
                        "Batch test one",
                        "First imported quest",
                        TaskCategory.BACKEND,
                        TaskStatus.COMPLETED,
                        LocalDate.of(2026, 9, 6)
                );

        CreateTaskRequest second =
                new CreateTaskRequest(
                        "Batch test two",
                        null,
                        TaskCategory.TESTING,
                        TaskStatus.IN_PROGRESS,
                        LocalDate.of(2026, 9, 7)
                );

        var responses =
                taskService.createBatch(
                        List.of(first, second)
                );

        assertEquals(
                2,
                responses.size()
        );

        assertEquals(
                2,
                taskRepository.count()
        );
    }

    @Test
    void rollsBackEntireBatchWhenOneTaskFails() {
        CreateTaskRequest validTask =
                new CreateTaskRequest(
                        "Valid batch task",
                        "This task should be rolled back",
                        TaskCategory.BACKEND,
                        TaskStatus.COMPLETED,
                        LocalDate.of(2026, 9, 6)
                );

        CreateTaskRequest invalidTask =
                new CreateTaskRequest(
                        null,
                        "This task has no title",
                        TaskCategory.TESTING,
                        TaskStatus.COMPLETED,
                        LocalDate.of(2026, 9, 6)
                );

        assertThrows(
                RuntimeException.class,
                () -> taskService.createBatch(
                        List.of(
                                validTask,
                                invalidTask
                        )
                )
        );

        assertEquals(
                0,
                taskRepository.count()
        );
    }

    @Test
    void rejectsInvalidTaskInsideBatchRequest() {
        CreateTaskRequest invalidTask =
                new CreateTaskRequest(
                        "",
                        "Invalid imported quest",
                        TaskCategory.BACKEND,
                        TaskStatus.COMPLETED,
                        LocalDate.of(2026, 9, 6)
                );

        BatchCreateTasksRequest request =
                new BatchCreateTasksRequest(
                        List.of(invalidTask)
                );

        var violations =
                validator.validate(request);

        assertFalse(
                violations.isEmpty()
        );

        assertEquals(
                0,
                taskRepository.count()
        );
    }
}