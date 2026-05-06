package ru.fkr.workpetproject.controller.moneta;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.fkr.workpetproject.dao.dto.moneta.MonetaSessionDto;
import ru.fkr.workpetproject.service.moneta.MonetaExportService;
import ru.fkr.workpetproject.service.moneta.MonetaService;
import ru.fkr.workpetproject.repository.moneta.VckpMonetaSessionRepository;
import ru.fkr.workpetproject.service.moneta.ValidationResult;
import ru.fkr.workpetproject.service.moneta.XmlValidatorService;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

@RestController
@RequestMapping("/api/moneta/moneta-sessions")
@RequiredArgsConstructor
@Slf4j
public class MonetaController {

    private final VckpMonetaSessionRepository sessionRepository;
    private final MonetaService monetaService;
    private final MonetaExportService exportService;
    private final XmlValidatorService xmlValidatorService;

    // GET /api/sessions?page=...&size=...
    @GetMapping
    public Page<MonetaSessionDto> getSessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "vckpMonetaSessionId"));
        return sessionRepository
                .findByVckpMonetaSessionIdGreaterThanOrderByVckpMonetaSessionIdDesc(165L, pageable)
                .map(MonetaSessionDto::fromEntity);
    }

    // GET /api/sessions/{id}
    @GetMapping("/{sessionId}" )
    public ResponseEntity<MonetaSessionDto> getSessionById(@PathVariable Long sessionId) {
        return sessionRepository.findById(sessionId)
                .map(MonetaSessionDto::fromEntity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{sessionId}/fill-addresses")
    public ResponseEntity<?> fillAddresses(@PathVariable Long sessionId) {
        monetaService.startAddressParsing(sessionId);
        return ResponseEntity.ok(Map.of("message", "Парсинг адресов запущен"));
    }

    @PostMapping("/{sessionId}/fill-sum")
    public ResponseEntity<?> fillSum(@PathVariable Long sessionId) {
        monetaService.startFillingSum(sessionId);
        return ResponseEntity.ok(Map.of("message", "Заполнение сумм запущено"));
    }

    @GetMapping("/export/{sessionId}")
    public void export(@PathVariable Long sessionId,
                       HttpServletResponse response) throws Exception {

        exportService.exportBySessionId(sessionId, response);
    }

    /**
     * Валидация XML файла перед загрузкой
     * XSD файл берется статически из resources
     */
    @PostMapping(value = "/validate-xml", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<ValidationResult> validateXmlBeforeUpload(
            @RequestParam(value = "xsdType", defaultValue = "request") String xsdType,
            HttpServletRequest request) {

        log.info("Валидация XML, тип XSD: {}", xsdType);

        try (InputStream xmlInputStream = request.getInputStream()) {
            String xsdPath = getXsdPathByType(xsdType);
            InputStream xsdInputStream = new ClassPathResource(xsdPath).getInputStream();

            ValidationResult result = xmlValidatorService.validateXmlAgainstXsd(xmlInputStream, xsdInputStream);

            if (result.isValid()) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            log.error("Ошибка при валидации XML", e);
            return ResponseEntity.internalServerError()
                    .body(ValidationResult.failure("Ошибка сервера: " + e.getMessage(), new java.util.ArrayList<>()));
        }
    }

    private String getXsdPathByType(String type) {
        return switch (type.toLowerCase()) {
            case "request" -> "xsd/qr_104_request.xsd";
            case "response" -> "xsd/qr_104_response.xsd";
            default -> "xsd/qr_104_response.xsd";
        };
    }
}

