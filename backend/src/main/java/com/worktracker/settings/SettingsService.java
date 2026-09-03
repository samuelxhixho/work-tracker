package com.worktracker.settings;

import com.worktracker.settings.dto.SettingsResponse;
import com.worktracker.settings.dto.UpdateSettingsRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class SettingsService {

    private static final long SETTINGS_ID = 1L;

    private static final String DEFAULT_DISPLAY_NAME =
            "User";

    private static final boolean DEFAULT_CONTEXTUAL_MESSAGES =
            true;

    private final SettingsRepository settingsRepository;

    public SettingsService(
            SettingsRepository settingsRepository
    ) {
        this.settingsRepository =
                settingsRepository;
    }

    @Transactional(readOnly = true)
    public SettingsResponse getSettings() {
        return settingsRepository
                .findById(SETTINGS_ID)
                .map(this::toResponse)
                .orElseGet(
                        this::getDefaultResponse
                );
    }

    @Transactional
    public SettingsResponse updateSettings(
            UpdateSettingsRequest request
    ) {
        AppSettings settings =
                settingsRepository
                        .findById(SETTINGS_ID)
                        .orElseGet(
                                this::createSettingsEntity
                        );

        settings.setDisplayName(
                request.displayName().trim()
        );

        settings.setContextualMessagesEnabled(
                request.contextualMessagesEnabled()
        );

        if (settings.getUpdatedAt() == null) {
            settings.setUpdatedAt(
                    LocalDateTime.now()
            );
        }

        AppSettings savedSettings =
                settingsRepository.save(settings);

        return toResponse(savedSettings);
    }

    private AppSettings createSettingsEntity() {
        AppSettings settings =
                new AppSettings();

        settings.setId(SETTINGS_ID);

        settings.setUpdatedAt(
                LocalDateTime.now()
        );

        return settings;
    }

    private SettingsResponse getDefaultResponse() {
        return new SettingsResponse(
                DEFAULT_DISPLAY_NAME,
                DEFAULT_CONTEXTUAL_MESSAGES,
                null
        );
    }

    private SettingsResponse toResponse(
            AppSettings settings
    ) {
        return new SettingsResponse(
                settings.getDisplayName(),
                settings.isContextualMessagesEnabled(),
                settings.getUpdatedAt()
        );
    }
}