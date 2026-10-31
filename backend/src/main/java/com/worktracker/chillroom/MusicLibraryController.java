package com.worktracker.chillroom;

import com.worktracker.chillroom.dto.MusicTrackResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.util.List;

@RestController
@RequestMapping("/api/chill-room/music")
public class MusicLibraryController {

    private final MusicLibraryService musicLibraryService;
    private final MusicStorageService musicStorageService;

    public MusicLibraryController(
            MusicLibraryService musicLibraryService,
            MusicStorageService musicStorageService
    ) {
        this.musicLibraryService =
                musicLibraryService;

        this.musicStorageService =
                musicStorageService;
    }

    @GetMapping
    public List<MusicTrackResponse> getTracks() {
        return musicLibraryService
                .getTracks();
    }

    @PostMapping(
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @ResponseStatus(HttpStatus.CREATED)
    public MusicTrackResponse addTrack(
            @RequestParam("file")
            MultipartFile file
    ) {
        return musicLibraryService
                .addTrack(file);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeTrack(
            @PathVariable Long id
    ) {
        musicLibraryService.removeTrack(id);
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<Resource> streamTrack(
            @PathVariable Long id
    ) {
        MusicTrack track =
                musicLibraryService.getTrack(id);

        Resource resource =
                musicStorageService.getStoredResource(
                        track.getStoredFilename()
                );

        return ResponseEntity.ok()
                .contentType(
                        MediaType.parseMediaType(
                                track.getContentType()
                        )
                )
                .header(
                        HttpHeaders.ACCEPT_RANGES,
                        "bytes"
                )
                .cacheControl(
                        CacheControl.noStore()
                )
                .body(resource);
    }
}