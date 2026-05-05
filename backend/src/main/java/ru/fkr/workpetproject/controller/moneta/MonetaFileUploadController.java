package ru.fkr.workpetproject.controller.moneta;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.fkr.workpetproject.dao.entity.VckpMonetaSession;
import ru.fkr.workpetproject.repository.moneta.VckpMonetaSessionRepository;
import ru.fkr.workpetproject.service.moneta.MonetaImportService;
import ru.fkr.workpetproject.utils.MonetaResolvePeriod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.time.LocalDate;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/moneta")
@RequiredArgsConstructor
public class MonetaFileUploadController {

    @Value("${moneta.upload-dir}")
    private String uploadDir;
    private final VckpMonetaSessionRepository sessionRepository;
    private final MonetaImportService monetaImportService;

    @PostMapping("/start-session")
    public ResponseEntity<Map<String, Object>> startSession(@RequestParam String fileName) {

        if (sessionRepository.existsByFileName(fileName)) {
            throw new IllegalArgumentException("Файл с указанным именем уже загружен");
        }

        VckpMonetaSession session = new VckpMonetaSession();
        session.setFileName(fileName);
        session.setDateUnload(LocalDate.now());
        session.setActive(true);
        session.setVckpMonetaTypeId(1L);
        session.setFileLoaded(false);
        session.setProgress(0.0);
        session.setVckpMonetaSessionStatus(monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.SESSION_CREATED));
        sessionRepository.save(session);

        return ResponseEntity.ok(Map.of("sessionId", session.getVckpMonetaSessionId()));
    }

    @PutMapping(value = "/upload-file", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<Void> uploadFile(@RequestParam String fileName, Long sessionId, HttpServletRequest request) {

        try (InputStream input = request.getInputStream()) {

            VckpMonetaSession session = sessionRepository.findVckpMonetaSessionsByVckpMonetaSessionId(sessionId);
            File uploadFolder = new File(uploadDir);
            if (!uploadFolder.exists()) {
                uploadFolder.mkdirs();
            }
            File tempFile = new File(uploadDir, "upload_" + sessionId + ".xml");
            try (OutputStream out = new FileOutputStream(tempFile)) {
                input.transferTo(out);
                session.setVckpMonetaSessionStatus(monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.FILE_LOADED));
                sessionRepository.save(session);
            } catch (Exception e) {
                log.error("❌ Ошибка при обработке файла", e);
            }


            try {
                monetaImportService.processSavedFile(sessionId, tempFile);
            } catch (Exception e) {
                log.error("❌ Ошибка при обработке XML-файла: {}", e.getMessage(), e);
                // 🧹 Удаляем сессию как неудачную
                sessionRepository.delete(sessionRepository.findVckpMonetaSessionsByVckpMonetaSessionId(sessionId));
                log.warn("🗑️ Удалена сессия id={} из-за ошибки", sessionId);

                throw new RuntimeException("Ошибка при обработке файла", e);
            }  finally {
                boolean deleted = tempFile.delete();
                if (deleted) {
                    log.info("🧹 XML-файл удалён: {}", tempFile.getAbsolutePath());
                } else {
                    log.warn("⚠️ Не удалось удалить файл: {}", tempFile.getAbsolutePath());
                }
            }

            return ResponseEntity.ok().build();

        } catch (Exception e) {
            log.error("❌ Ошибка при обработке XML-файла: {}", e.getMessage(), e);
            // 🧹 Удаляем сессию как неудачную
            sessionRepository.delete(sessionRepository.findVckpMonetaSessionsByVckpMonetaSessionId(sessionId));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
