package com.sketchflow.repository;

import com.sketchflow.entity.BoardMember;
import com.sketchflow.entity.BoardRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BoardMemberRepository extends JpaRepository<BoardMember, UUID> {
    List<BoardMember> findByBoardId(UUID boardId);
    Optional<BoardMember> findByBoardIdAndUserId(UUID boardId, UUID userId);
    void deleteByBoardIdAndUserId(UUID boardId, UUID userId);
}
