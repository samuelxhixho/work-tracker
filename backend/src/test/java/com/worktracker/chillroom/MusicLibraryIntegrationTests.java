package com.worktracker.chillroom;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class MusicLibraryIntegrationTests {

    @TempDir
    static Path tempDirectory;

    @DynamicPropertySource
    static void configureProperties(
            DynamicPropertyRegistry registry
    ) {
        registry.add(
                "worktracker.media.music-directory",
                () -> tempDirectory
                        .resolve("music")
                        .toString()
        );
    }

    @Autowired
    private MusicLibraryService musicLibraryService;

    @Autowired
    private MusicTrackRepository musicTrackRepository;

    @Autowired
    private MusicStorageService musicStorageService;

    @BeforeEach
    void setUp() throws IOException {
        musicTrackRepository.deleteAll();

        Files.createDirectories(
                musicStorageService
                        .getMusicDirectory()
        );

        try (
                var files =
                        Files.list(
                                musicStorageService
                                        .getMusicDirectory()
                        )
        ) {
            files
                    .filter(Files::isRegularFile)
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException exception) {
                            throw new RuntimeException(
                                    exception
                            );
                        }
                    });
        }
    }

    @Test
    void storesMusicFileAndMetadata() {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "night-drive.mp3",
                        "audio/mpeg",
                        "fake-audio-data".getBytes()
                );

        var response =
                musicLibraryService
                        .addTrack(file);

        assertEquals(
                "night-drive",
                response.title()
        );

        assertEquals(
                "night-drive.mp3",
                response.originalFilename()
        );

        assertEquals(
                1,
                musicTrackRepository.count()
        );

        assertTrue(
                Files.exists(
                        musicStorageService
                                .resolveStoredFile(
                                        musicTrackRepository
                                                .findAll()
                                                .getFirst()
                                                .getStoredFilename()
                                )
                )
        );
    }

    @Test
    void rejectsUnsupportedFileType() {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "notes.txt",
                        "text/plain",
                        "not music".getBytes()
                );

        assertThrows(
                ResponseStatusException.class,
                () -> musicLibraryService
                        .addTrack(file)
        );

        assertEquals(
                0,
                musicTrackRepository.count()
        );
    }

    @Test
    void rejectsEmptyMusicFile() {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "empty.mp3",
                        "audio/mpeg",
                        new byte[0]
                );

        assertThrows(
                ResponseStatusException.class,
                () -> musicLibraryService
                        .addTrack(file)
        );

        assertEquals(
                0,
                musicTrackRepository.count()
        );
    }

    @Test
    void removesTrackAndStoredFile() {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "remove-me.mp3",
                        "audio/mpeg",
                        "test-audio".getBytes()
                );

        Long id = musicLibraryService
                .addTrack(file)
                .id();

        String storedFilename =
                musicTrackRepository
                        .findById(id)
                        .orElseThrow()
                        .getStoredFilename();

        Path storedPath =
                musicStorageService
                        .resolveStoredFile(storedFilename);

        assertTrue(Files.exists(storedPath));

        musicLibraryService.removeTrack(id);

        assertEquals(0, musicTrackRepository.count());
        assertFalse(Files.exists(storedPath));
    }

    @Test
    void returnsNotFoundWhenRemovingMissingTrack() {
        ResponseStatusException exception =
                assertThrows(
                        ResponseStatusException.class,
                        () -> musicLibraryService
                                .removeTrack(Long.MAX_VALUE)
                );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );
    }

    @Test
    void removesMetadataWhenStoredFileIsAlreadyMissing()
            throws IOException {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "missing-file.mp3",
                        "audio/mpeg",
                        "test-audio".getBytes()
                );

        Long id = musicLibraryService
                .addTrack(file)
                .id();

        String storedFilename =
                musicTrackRepository
                        .findById(id)
                        .orElseThrow()
                        .getStoredFilename();

        Files.delete(
                musicStorageService
                        .resolveStoredFile(storedFilename)
        );

        musicLibraryService.removeTrack(id);

        assertEquals(0, musicTrackRepository.count());
    }
}