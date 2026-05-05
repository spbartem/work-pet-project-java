package ru.fkr.workpetproject.utils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.fkr.workpetproject.repository.moneta.VckpMonetaSessionRepository;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonetaResolvePeriod {

    private static VckpMonetaSessionRepository sessionRepository = null;

    public MonetaResolvePeriod(VckpMonetaSessionRepository sessionRepository) {
        MonetaResolvePeriod.sessionRepository = sessionRepository;
    }

    public static String resolvePeriod(Long sessionId) {

        String fileName =
                sessionRepository.findFileNameById(sessionId);

        if (fileName == null || fileName.isBlank()) {
            return "";
        }

        // ожидаем: QR_140440_202503.xml
        Pattern pattern = Pattern.compile("(\\d{6})\\.xml$");
        Matcher matcher = pattern.matcher(fileName);

        if (!matcher.find()) {
            return "";
        }

        String raw = matcher.group(1);

        String year = raw.substring(0, 4);
        String month = raw.substring(4, 6);

        return year + month;
    }
}
