package com.sketchflow.repository;

import com.sketchflow.entity.Board;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BoardRepository extends JpaRepository<Board, UUID> {
    List<Board> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

    @Query("""
        SELECT b FROM Board b 
        WHERE b.ownerId = :userId 
        OR b.id IN (SELECT bm.boardId FROM BoardMember bm WHERE bm.userId = :userId)
        ORDER BY b.updatedAt DESC
    """)
    List<Board> findAccessibleBoards(@Param("userId") UUID userId);
}
