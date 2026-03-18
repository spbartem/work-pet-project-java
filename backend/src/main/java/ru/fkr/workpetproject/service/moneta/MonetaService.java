package ru.fkr.workpetproject.service.moneta;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import ru.fkr.workpetproject.dao.entity.VckpMonetaSession;
import ru.fkr.workpetproject.repository.moneta.VckpMonetaSessionRepository;
import ru.fkr.workpetproject.utils.NumberUtils;

import java.math.BigInteger;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonetaService {

    private final JdbcTemplate jdbcTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final VckpMonetaSessionRepository sessionRepository;
    private final MonetaImportService monetaImportService;

    @Async
    public void startAddressParsing(Long sessionId) {
        log.info("▶ Старт обработки адресов для sessionId={}", sessionId);

        VckpMonetaSession session = sessionRepository.findById(sessionId).orElseThrow();
        session.setVckpMonetaSessionStatus(
                monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.ADDRESS_FILLING)
        );
        sessionRepository.save(session);

        try {
            // Общее количество записей
            Integer totalCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vckp_moneta WHERE vckp_moneta_session_id = ?",
                    Integer.class,
                    sessionId
            );

            // Общее количество необработанных записей
            int totalCountNotProcessed = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM vckp_moneta WHERE vckp_moneta_session_id = ? AND NOT processed",
                    Integer.class,
                    sessionId
            );

            String sqlParseAddressStart = "SELECT * FROM vckp_moneta_parse_address_start(?)";
            Map<String, Object> parse_address_start_result = jdbcTemplate.queryForMap(sqlParseAddressStart, sessionId);
            BigInteger actionId = null;
            Object actionIdObj = parse_address_start_result.get("action_id_out");
            if (actionIdObj != null) {
                actionId = (actionIdObj instanceof BigInteger)
                        ? (BigInteger) actionIdObj
                        : BigInteger.valueOf(((Number) actionIdObj).longValue());
            }
            int batchSize = 1000;
            int iterations = (totalCountNotProcessed + batchSize - 1) / batchSize;
            int processed = 0;

            // Цикл вызова функции порциями
            for (int i = 0; i < iterations; i++) {
                jdbcTemplate.execute("SELECT * FROM vckp_moneta_parse_address_limit(" + sessionId + ")");

                // Обновление прогресса и отправка на фронт
                processed += batchSize;
                if (processed > totalCountNotProcessed) processed = totalCountNotProcessed;

                float progress = (float) processed / totalCountNotProcessed;
                String message = NumberUtils.formatNumber(processed) + " из " + NumberUtils.formatNumber(totalCountNotProcessed) + " необработанных (Всего записей: " + NumberUtils.formatNumber(totalCount) + ")";

                messagingTemplate.convertAndSend(
                        "/topic/address-progress",
                        Map.of(
                                "sessionId", sessionId,
                                "processed", progress,
                                "message", message
                        )
                );
            }

            messagingTemplate.convertAndSend(
                    "/topic/address-progress",
                    Map.of(
                            "sessionId", sessionId,
                            "process", "address_final_start",
                            "message", "Адреса разобраны. Обновляются сопутствующие данные..."
                    )
            );

            jdbcTemplate.execute(
                    "SELECT * FROM vckp_moneta_parse_address_final(" + sessionId + ", " + actionId + ")"
                );

            messagingTemplate.convertAndSend(
                    "/topic/address-progress",
                    Map.of(
                            "sessionId", sessionId,
                            "process", "address_final_end",
                            "message", "Обработка адресов завершена"
                    )
            );

            session.setVckpMonetaSessionStatus(
                    monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.ADDRESS_ENTERED)
            );

            sessionRepository.save(session);

        } catch (Exception e) {
            log.error("❌ Ошибка при вызове parse_address_limit: ", e);
            messagingTemplate.convertAndSend(
                    "/topic/address-progress",
                    Map.of(
                            "sessionId", sessionId,
                            "error", true,
                            "message", "Ошибка при вызове функции: " + e.getCause()
                    )
            );
            session.setVckpMonetaSessionStatus(
                    monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.FILE_PARSING)
            );
            sessionRepository.save(session);
        }
    }

    @Async
    public void startFillingSum(Long sessionId) {

        VckpMonetaSession session = sessionRepository.findById(sessionId).orElseThrow();

        session.setVckpMonetaSessionStatus(
                monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.SUM_FILLING)
        );
        sessionRepository.save(session);

        try {
            String sqlFillSum = "SELECT * FROM vckp_moneta_calc(?, ?)";
            Integer processType = 1;
            Map<String, Object> fillSumResult = jdbcTemplate.queryForMap(sqlFillSum, sessionId, processType);

            Integer resFillSum = (Integer) fillSumResult.get("res");
            String errMessFillSum = (String) fillSumResult.get("err_mess");

            if (resFillSum >= 0)  {
                session.setVckpMonetaSessionStatus(
                        monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.SUM_ENTERED)
                );

                messagingTemplate.convertAndSend(
                        "/topic/sum-progress",
                        Map.of(
                                "sessionId", sessionId,
                                "process", "fill_sum_end",
                                "message", "Заполнение сумм завершено"
                        )
                );
            } else {
                session.setVckpMonetaSessionStatus(
                        monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.ADDRESS_ENTERED)
                );

                messagingTemplate.convertAndSend(
                        "/topic/sum-progress",
                        Map.of(
                                "sessionId", sessionId,
                                "res", resFillSum,
                                "message", errMessFillSum
                        )
                );
            }

            sessionRepository.save(session);

        } catch (Exception e) {
            log.error("❌ Ошибка при вызове parse_address_limit: ", e);
            messagingTemplate.convertAndSend(
                    "/topic/address-progress",
                    Map.of(
                            "sessionId", sessionId,
                            "error", true,
                            "message", "Ошибка при вызове функции: " + e.getCause()
                    )
            );

            session.setVckpMonetaSessionStatus(
                    monetaImportService.resolveStatus(MonetaImportService.vckpMonetaSessionStatusEnum.ADDRESS_ENTERED)
            );
            sessionRepository.save(session);
        }
    }
}
