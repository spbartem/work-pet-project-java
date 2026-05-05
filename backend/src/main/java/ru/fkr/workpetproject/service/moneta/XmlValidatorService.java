package ru.fkr.workpetproject.service.moneta;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;
import org.xml.sax.helpers.DefaultHandler;

import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class XmlValidatorService {

    private static final String TEMP_DIR = System.getProperty("java.io.tmpdir") + "/xml-validation/";

    /**
     * Валидация XML файла (MultipartFile) против XSD (InputStream)
     */
    public ValidationResult validateXmlAgainstXsd(MultipartFile xmlFile, InputStream xsdInputStream) {
        Path xmlTempPath = null;

        try {
            Files.createDirectories(Paths.get(TEMP_DIR));
            xmlTempPath = saveTempFile(xmlFile, "xml_");

            return validateXMLSchema(xsdInputStream, xmlTempPath.toString());

        } catch (IOException e) {
            log.error("Ошибка при сохранении временных файлов", e);
            return ValidationResult.failure("Ошибка при обработке файлов: " + e.getMessage(), new ArrayList<>());
        } finally {
            cleanupTempFiles(xmlTempPath);
        }
    }

    /**
     * Валидация XML файла (File) против XSD (InputStream)
     */
    public ValidationResult validateXmlAgainstXsd(File xmlFile, InputStream xsdInputStream) {
        return validateXMLSchema(xsdInputStream, xmlFile.getAbsolutePath());
    }

    /**
     * Валидация XML файла против XSD из файловой системы
     */
    public ValidationResult validateXmlAgainstXsd(File xmlFile, File xsdFile) {
        List<ValidationResult.ValidationError> errors = new ArrayList<>();

        try {
            SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
            Schema schema = factory.newSchema(xsdFile);
            Validator validator = schema.newValidator();

            setupErrorHandler(validator, errors);
            validator.validate(new StreamSource(xmlFile));

            return buildResult(errors);

        } catch (Exception e) {
            log.error("Exception during validation", e);
            return ValidationResult.failure("Ошибка при валидации: " + e.getMessage(), errors);
        }
    }

    private ValidationResult validateXMLSchema(InputStream xsdInputStream, String xmlPath) {
        List<ValidationResult.ValidationError> errors = new ArrayList<>();

        try {
            SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
            Schema schema = factory.newSchema(new StreamSource(xsdInputStream));
            Validator validator = schema.newValidator();

            setupErrorHandler(validator, errors);
            validator.validate(new StreamSource(new File(xmlPath)));

            return buildResult(errors);

        } catch (SAXParseException e) {
            return ValidationResult.failure("Ошибка валидации", errors);
        } catch (IOException | SAXException e) {
            log.error("Exception during validation", e);
            errors.add(createError("ERROR", 0, 0, e.getMessage()));
            return ValidationResult.failure("Ошибка при валидации: " + e.getMessage(), errors);
        }
    }

    private void setupErrorHandler(Validator validator, List<ValidationResult.ValidationError> errors) {
        validator.setErrorHandler(new DefaultHandler() {
            @Override
            public void warning(SAXParseException e) {
                errors.add(createError("WARNING", e.getLineNumber(), e.getColumnNumber(), e.getMessage()));
                log.warn("Warning at line {}: {}", e.getLineNumber(), e.getMessage());
            }

            @Override
            public void error(SAXParseException e) throws SAXException {
                errors.add(createError("ERROR", e.getLineNumber(), e.getColumnNumber(), e.getMessage()));
                log.error("Error at line {}: {}", e.getLineNumber(), e.getMessage());
                throw e;
            }

            @Override
            public void fatalError(SAXParseException e) throws SAXException {
                errors.add(createError("FATAL", e.getLineNumber(), e.getColumnNumber(), e.getMessage()));
                log.error("Fatal error at line {}: {}", e.getLineNumber(), e.getMessage());
                throw e;
            }
        });
    }

    private ValidationResult.ValidationError createError(String type, int line, int column, String message) {
        return ValidationResult.ValidationError.builder()
                .type(type)
                .line(line)
                .column(column)
                .message(message)
                .build();
    }

    private ValidationResult buildResult(List<ValidationResult.ValidationError> errors) {
        if (errors.isEmpty()) {
            return ValidationResult.success();
        }

        boolean hasErrors = errors.stream()
                .anyMatch(e -> "ERROR".equals(e.getType()) || "FATAL".equals(e.getType()));

        if (hasErrors) {
            return ValidationResult.failure("Найдены критические ошибки валидации", errors);
        } else {
            return ValidationResult.failure("Найдены предупреждения валидации", errors);
        }
    }

    private Path saveTempFile(MultipartFile file, String prefix) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = "";

        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        Path tempFile = Paths.get(TEMP_DIR, prefix + UUID.randomUUID().toString() + extension);
        Files.copy(file.getInputStream(), tempFile);
        return tempFile;
    }

    private void cleanupTempFiles(Path... paths) {
        for (Path path : paths) {
            if (path != null) {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    log.warn("Не удалось удалить временный файл: {}", path, e);
                }
            }
        }
    }
}