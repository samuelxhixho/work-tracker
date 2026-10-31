package com.worktracker.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class LocalAiController {

    private final LocalAiService localAiService;
    private final LocalAiGenerationService generationService;
    private final LocalAiImportService importService;

    public LocalAiController(
            LocalAiService localAiService,
            LocalAiGenerationService generationService,
            LocalAiImportService importService
    ) {
        this.localAiService = localAiService;
        this.generationService = generationService;
        this.importService = importService;
    }

    @GetMapping("/availability")
    public ResponseEntity<LocalAiService.Availability> availability() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(localAiService.checkAvailability());
    }

    @PostMapping("/summary")
    public ResponseEntity<LocalAiGenerationService.Summary> summarize(
            @Valid @RequestBody SummaryRequest request
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(generationService.summarize(request.requestId(), request.notes()));
    }

    @PostMapping("/chat")
    public ResponseEntity<LocalAiGenerationService.ChatReply> chat(
            @Valid @RequestBody ChatRequest request
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(generationService.chat(
                        request.requestId(),
                        request.messages(),
                        request.currentPage(),
                        request.playerState(),
                        request.listCursor()
                ));
    }

    @PostMapping("/import-preview")
    public ResponseEntity<LocalAiImportService.ImportPreview> importPreview(
            @Valid @RequestBody ImportPreviewRequest request
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(importService.extract(request.text()));
    }

    @PostMapping("/requests/{requestId}/cancel")
    public ResponseEntity<CancelResponse> cancel(
            @PathVariable("requestId") UUID requestId
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new CancelResponse(generationService.cancel(requestId)));
    }

    public record ImportPreviewRequest(
            @NotBlank
            @Size(max = 8000)
            String text
    ) {
    }

    public record SummaryRequest(
            @NotNull UUID requestId,
            @NotBlank @Size(max = 2000) String notes
    ) {
    }

    public record ChatRequest(
            @NotNull UUID requestId,
            @NotNull @Size(min = 1, max = 11)
            List<LocalAiGenerationService.ChatMessage> messages,
            @Size(max = 100) String currentPage,
            @Valid PlayerState playerState,
            @Valid LocalAiGenerationService.ListCursor listCursor
    ) {
    }

    public record PlayerState(
            @Size(max = 140) String trackTitle,
            @Size(max = 100) String artist,
            boolean playing,
            boolean loading,
            int volume,
            double currentTime,
            double duration
    ) {
    }

    public record CancelResponse(boolean cancelled) {
    }
}