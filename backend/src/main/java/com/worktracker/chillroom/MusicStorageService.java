package com.worktracker.chillroom;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.LinkOption;

@Service
public class MusicStorageService {

    private final Path musicDirectory;

    public MusicStorageService(
            @Value("${worktracker.media.music-directory}")
            String musicDirectory
    ) {
        this.musicDirectory =
                Path.of(musicDirectory)
                        .toAbsolutePath()
                        .normalize();

        createMusicDirectory();
    }

    public Path getMusicDirectory() {
        return musicDirectory;
    }

    public String store(
            MultipartFile file,
            String extension
    ) {
        String storedFilename =
                UUID.randomUUID()
                        + "."
                        + extension;

        Path destination =
                resolveStoredFile(storedFilename);

        try {
            Files.copy(
                    file.getInputStream(),
                    destination
            );
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Could not store music file",
                    exception
            );
        }

        return storedFilename;
    }

    public void deleteStoredFile(
            String storedFilename
    ) {
        try {
            Files.deleteIfExists(
                    resolveStoredFile(storedFilename)
            );
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Could not delete music file",
                    exception
            );
        }
    }

    public Path resolveStoredFile(
            String storedFilename
    ) {
        Path resolvedPath =
                musicDirectory
                        .resolve(storedFilename)
                        .normalize();

        if (!resolvedPath.startsWith(musicDirectory)) {
            throw new IllegalArgumentException(
                    "Invalid music file path"
            );
        }

        return resolvedPath;
    }

    public Resource getStoredResource(
            String storedFilename
    ) {
        Path path = resolveStoredFile(storedFilename);

        try {
            if (!Files.isRegularFile(
                    path,
                    LinkOption.NOFOLLOW_LINKS
            )) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Music file not found"
                );
            }

            Path realDirectory =
                    musicDirectory.toRealPath();

            Path realPath =
                    path.toRealPath();

            if (!realPath.startsWith(realDirectory)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Music file not found"
                );
            }

            if (!Files.isReadable(realPath)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Music file not found"
                );
            }

            return new FileSystemResource(realPath);
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Music file not found",
                    exception
            );
        }
    }

    private void createMusicDirectory() {
        try {
            Files.createDirectories(
                    musicDirectory
            );
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Could not create music directory",
                    exception
            );
        }
    }
}