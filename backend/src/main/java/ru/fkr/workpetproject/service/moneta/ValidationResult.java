package ru.fkr.workpetproject.service.moneta;

import lombok.Data;
import lombok.Builder;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class ValidationResult {
    private boolean valid;
    private String message;
    private LocalDateTime timestamp;
    private List<ValidationError> errors;

    @Data
    @Builder
    public static class ValidationError {
        private String type; // ERROR, WARNING, FATAL
        private int line;
        private int column;
        private String message;
    }

    public static ValidationResult success() {
        return ValidationResult.builder()
                .valid(true)
                .message("XML документ успешно прошел валидацию")
                .timestamp(LocalDateTime.now())
                .errors(new ArrayList<>())
                .build();
    }

    public static ValidationResult failure(String message, List<ValidationError> errors) {
        return ValidationResult.builder()
                .valid(false)
                .message(message)
                .timestamp(LocalDateTime.now())
                .errors(errors)
                .build();
    }
}
