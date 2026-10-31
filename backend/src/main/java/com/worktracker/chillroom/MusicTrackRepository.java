package com.worktracker.chillroom;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MusicTrackRepository
        extends JpaRepository<MusicTrack, Long> {

    List<MusicTrack> findAllByOrderByCreatedAtDesc();
}