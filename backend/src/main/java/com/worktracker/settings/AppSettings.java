package com.worktracker.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_settings")
@Getter
@Setter
@NoArgsConstructor
public class AppSettings {

    @Id
    private Long id;

    @Column(
            name = "display_name",
            nullable = false,
            length = 80
    )
    private String displayName;

    @Column(
            name = "contextual_messages_enabled",
            nullable = false
    )
    private boolean contextualMessagesEnabled;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private LocalDateTime updatedAt;

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}