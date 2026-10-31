package com.worktracker.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    Optional<Task> findFirstByOrderByWorkDateAscIdAsc();

    List<Task> findByWorkDateBetweenOrderByWorkDateAsc(
            LocalDate from,
            LocalDate to
    );

    long countByStatus(TaskStatus status);

    long countByWorkDateBetweenAndStatus(
            LocalDate from,
            LocalDate to,
            TaskStatus status
    );

    List<Task> findTop4ByStatusOrderByWorkDateDescIdDesc(
            TaskStatus status
    );

    List<Task> findTop4ByWorkDateBetweenOrderByWorkDateDescIdDesc(
            LocalDate from,
            LocalDate to
    );
}