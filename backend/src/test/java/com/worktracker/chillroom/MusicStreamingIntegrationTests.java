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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class MusicStreamingIntegrationTests {

    private static final byte[] AUDIO_BYTES =
            "sample-audio-data".getBytes(
                    StandardCharsets.US_ASCII
            );

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
    private WebApplicationContext webApplicationContext;

    @Autowired
    private MusicLibraryService musicLibraryService;

    @Autowired
    private MusicTrackRepository musicTrackRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .build();

        musicTrackRepository.deleteAll();
    }

    @Test
    void streamsCompleteMusicFile() throws Exception {
        Long id = createTrack();

        mockMvc.perform(
                        get("/api/chill-room/music/{id}/stream", id)
                )
                .andExpect(status().isOk())
                .andExpect(content().contentType("audio/mpeg"))
                .andExpect(content().bytes(AUDIO_BYTES))
                .andExpect(header().string(
                        "Accept-Ranges",
                        "bytes"
                ));
    }

    @Test
    void streamsRequestedByteRange() throws Exception {
        Long id = createTrack();

        mockMvc.perform(
                        get("/api/chill-room/music/{id}/stream", id)
                                .header("Range", "bytes=2-5")
                )
                .andExpect(status().isPartialContent())
                .andExpect(header().string(
                        "Content-Range",
                        "bytes 2-5/17"
                ))
                .andExpect(content().bytes(
                        "mple".getBytes(
                                StandardCharsets.US_ASCII
                        )
                ));
    }

    @Test
    void returnsNotFoundForMissingTrack() throws Exception {
        mockMvc.perform(
                        get(
                                "/api/chill-room/music/{id}/stream",
                                Long.MAX_VALUE
                        )
                )
                .andExpect(status().isNotFound());
    }

    private Long createTrack() {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "stream-test.mp3",
                        "audio/mpeg",
                        AUDIO_BYTES
                );

        return musicLibraryService
                .addTrack(file)
                .id();
    }
}