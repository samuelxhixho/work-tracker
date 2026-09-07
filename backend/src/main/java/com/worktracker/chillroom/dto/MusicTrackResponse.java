package com.worktracker.chillroom.dto;

import java.time.LocalDateTime;

public record MusicTrackResponse(
        Long id,
        String title,
        String artist,
        String originalFilename,
        String contentType,
        long fileSizeBytes,
        LocalDateTime createdAt
) {
}