package ru.fkr.workpetproject.repository.moneta;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import ru.fkr.workpetproject.dao.entity.VckpMonetaSession;

import java.util.Optional;

@Repository
public interface VckpMonetaSessionRepository extends JpaRepository<VckpMonetaSession, Long> {
    VckpMonetaSession findVckpMonetaSessionsByVckpMonetaSessionId(Long sessionId);
    Optional<VckpMonetaSession> findFirstByVckpMonetaSessionStatus_StatusCodeOrderByVckpMonetaSessionIdDesc(String statusCode);
    boolean existsByFileName(String fileName);

    @Query("""
       select s.fileName
       from VckpMonetaSession s
       where s.vckpMonetaSessionId = :id
       """)
    String findFileNameById(@Param("id") Long id);

    Page<VckpMonetaSession> findByVckpMonetaSessionIdGreaterThanOrderByVckpMonetaSessionIdDesc(Long sessionId, Pageable pageable);
}
