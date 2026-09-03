package com.worktracker.settings;

import com.worktracker.settings.dto.SettingsResponse;
import com.worktracker.settings.dto.UpdateSettingsRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(
            SettingsService settingsService
    ) {
        this.settingsService =
                settingsService;
    }

    @GetMapping
    public SettingsResponse getSettings() {
        return settingsService
                .getSettings();
    }

    @PutMapping
    public SettingsResponse updateSettings(
            @Valid
            @RequestBody
            UpdateSettingsRequest request
    ) {
        return settingsService
                .updateSettings(request);
    }
}