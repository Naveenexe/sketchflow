package com.sketchflow.repository;

import com.sketchflow.entity.BoardSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BoardSnapshotRepository extends JpaRepository<BoardSnapshot, UUID> {
    List<BoardSnapshot> findByBoardIdOrderByVersionDesc(UUID boardId);
}
