package com.worktracker.chillroom;

import com.worktracker.chillroom.dto.MusicTrackResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class MusicLibraryService {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(MusicLibraryService.class);

    private static final long MAX_FILE_SIZE_BYTES =
            100L * 1024L * 1024L;

    private static final Set<String> SUPPORTED_EXTENSIONS =
            Set.of(
                    "mp3",
                    "wav",
                    "ogg",
                    "m4a"
            );

    private final MusicTrackRepository musicTrackRepository;
    private final MusicStorageService musicStorageService;

    public MusicLibraryService(
            MusicTrackRepository musicTrackRepository,
            MusicStorageService musicStorageService
    ) {
        this.musicTrackRepository =
                musicTrackRepository;

        this.musicStorageService =
                musicStorageService;
    }

    public List<MusicTrackResponse> getTracks() {
        return musicTrackRepository
                .findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MusicTrack getTrack(
            Long id
    ) {
        return musicTrackRepository
                .findById(id)
                .orElseThrow(
                        () -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Music track not found"
                        )
                );
    }

    @Transactional
    public void removeTrack(Long id) {
        MusicTrack track = getTrack(id);

        String storedFilename =
                track.getStoredFilename();

        musicTrackRepository.delete(track);
        musicTrackRepository.flush();

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            musicStorageService.deleteStoredFile(
                                    storedFilename
                            );
                        } catch (RuntimeException exception) {
                            LOGGER.warn(
                                    "Could not remove stored music file: {}",
                                    storedFilename,
                                    exception
                            );
                        }
                    }
                }
        );
    }

    public MusicTrackResponse addTrack(
            MultipartFile file
    ) {
        String originalFilename =
                validateAndGetFilename(file);

        String extension =
                getExtension(originalFilename);

        String storedFilename =
                musicStorageService.store(
                        file,
                        extension
                );

        try {
            MusicTrack track =
                    new MusicTrack();

            track.setTitle(
                    getDisplayTitle(
                            originalFilename
                    )
            );

            track.setArtist(null);

            track.setOriginalFilename(
                    originalFilename
            );

            track.setStoredFilename(
                    storedFilename
            );

            track.setContentType(
                    getContentType(extension)
            );

            track.setFileSizeBytes(
                    file.getSize()
            );

            MusicTrack savedTrack =
                    musicTrackRepository
                            .saveAndFlush(track);

            return toResponse(savedTrack);
        } catch (RuntimeException exception) {
            musicStorageService.deleteStoredFile(
                    storedFilename
            );

            throw exception;
        }
    }

    private String validateAndGetFilename(
            MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            throw badRequest(
                    "Choose a non-empty audio file."
            );
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw badRequest(
                    "Music files cannot exceed 100 MB."
            );
        }

        String originalFilename =
                file.getOriginalFilename();

        if (
                originalFilename == null ||
                        originalFilename.isBlank()
        ) {
            throw badRequest(
                    "The audio file must have a filename."
            );
        }

        originalFilename =
                originalFilename
                        .replace('\\', '/');

        int separatorIndex =
                originalFilename
                        .lastIndexOf('/');

        if (separatorIndex >= 0) {
            originalFilename =
                    originalFilename.substring(
                            separatorIndex + 1
                    );
        }

        if (originalFilename.isBlank()) {
            throw badRequest(
                    "The audio file must have a filename."
            );
        }

        String extension =
                getExtension(originalFilename);

        if (!SUPPORTED_EXTENSIONS.contains(extension)) {
            throw badRequest(
                    "Supported formats are MP3, WAV, OGG and M4A."
            );
        }

        return originalFilename;
    }

    private String getExtension(
            String filename
    ) {
        int dotIndex =
                filename.lastIndexOf('.');

        if (
                dotIndex < 0 ||
                        dotIndex == filename.length() - 1
        ) {
            return "";
        }

        return filename
                .substring(dotIndex + 1)
                .toLowerCase(Locale.ROOT);
    }

    private String getDisplayTitle(
            String filename
    ) {
        int dotIndex =
                filename.lastIndexOf('.');

        String title =
                dotIndex > 0
                        ? filename.substring(
                        0,
                        dotIndex
                )
                        : filename;

        title = title.trim();

        return title.isEmpty()
                ? "Untitled track"
                : title;
    }

    private String getContentType(
            String extension
    ) {
        return switch (extension) {
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "ogg" -> "audio/ogg";
            case "m4a" -> "audio/mp4";
            default -> "application/octet-stream";
        };
    }

    private ResponseStatusException badRequest(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private MusicTrackResponse toResponse(
            MusicTrack track
    ) {
        return new MusicTrackResponse(
                track.getId(),
                track.getTitle(),
                track.getArtist(),
                track.getOriginalFilename(),
                track.getContentType(),
                track.getFileSizeBytes(),
                track.getCreatedAt()
        );
    }
}