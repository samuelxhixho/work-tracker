package com.worktracker.settings.dto;

import java.time.LocalDateTime;

public record SettingsResponse(
        String displayName,
        boolean contextualMessagesEnabled,
        LocalDateTime updatedAt
) {
}