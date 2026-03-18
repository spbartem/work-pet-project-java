package ru.fkr.workpetproject.service.moneta;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import ru.fkr.workpetproject.repository.moneta.VckpMonetaSessionRepository;

import javax.xml.stream.XMLOutputFactory;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamWriter;
import java.io.OutputStream;

@Service
@RequiredArgsConstructor
public class MonetaExportService {

    private final JdbcTemplate jdbcTemplate;
    private final VckpMonetaSessionRepository sessionRepository;

    private static final String ORG_CODE = "140440";

    // =====================================================
    // PUBLIC API
    // =====================================================
    public void exportBySessionId(Long sessionId,
                                  HttpServletResponse response) throws Exception {

        String period = resolvePeriod(sessionId);

        response.setContentType("application/xml");
        response.setHeader(
                "Content-Disposition",
                "attachment; filename=QR_" + ORG_CODE + "_" +
                        period.replace("-", "") + ".xml"
        );

        XMLOutputFactory factory = XMLOutputFactory.newFactory();

        try (OutputStream os = response.getOutputStream()) {

            XMLStreamWriter xml =
                    factory.createXMLStreamWriter(os, "UTF-8");

            writeRootStart(xml, period);

            streamRepRows(xml, sessionId);

            xml.writeEndElement(); // ns2:QR
            xml.writeEndDocument();

            xml.flush();
        }
    }

    // =====================================================
    // PERIOD FROM FILE_NAME
    // =====================================================
    private String resolvePeriod(Long sessionId) {

        String fileName =
                sessionRepository.findFileNameById(sessionId);

        if (fileName == null || !fileName.matches(".*_(\\d{6})\\.xml"))
            return "";

        String ym = fileName.replaceAll(".*_(\\d{6})\\.xml", "$1");

        return ym.substring(0, 4) + "-" + ym.substring(4, 6);
    }

    // =====================================================
    // ROOT XML
    // =====================================================
    private void writeRootStart(XMLStreamWriter xml, String period)
            throws XMLStreamException {

        xml.writeStartElement(
                "ns2",
                "QR",
                "http://msp.gcjs.spb/QR/1.0.4"
        );

        xml.writeNamespace("xs",
                "http://www.w3.org/2001/XMLSchema");

        xml.writeNamespace("ns2",
                "http://msp.gcjs.spb/QR/1.0.4");

        xml.writeAttribute("PERIOD", period);
        xml.writeAttribute("ORG_CODE", ORG_CODE);

        newline(xml);
    }

    // =====================================================
    // STREAM DATA FROM DB
    // =====================================================
    private void streamRepRows(XMLStreamWriter xml, Long sessionId)
            throws XMLStreamException {

        jdbcTemplate.query("""
                SELECT period, rep_acc, els, sq_pay, premise_guid, nkv,
                       room_guid, room, ul, kod_fias,
                       ls_type, ls_id, kr_sum, rep_trf,
                       regn, kr_st, lgt_kr, res_code
                FROM vckp_moneta
                WHERE vckp_moneta_session_id = ?
                """,
                rs -> {

                    try {
                        indent(xml);
                        xml.writeEmptyElement("REP");

                        attr(xml, "PERIOD_ACC", rs.getString("period"));
                        attr(xml, "REP_ACC", rs.getString("rep_acc"));
                        attr(xml, "LS_ID", rs.getObject("ls_id"));
                        attr(xml, "SQ_PAY", rs.getObject("sq_pay"));
                        attr(xml, "ELS", rs.getString("els"));
                        attr(xml, "LS_TYPE", rs.getObject("ls_type"));
                        attr(xml, "OBJECT_GUID", rs.getString("kod_fias"));
                        attr(xml, "OBJECT_ADDRESS", rs.getString("ul"));
                        attr(xml, "FLAT", rs.getString("nkv"));
                        attr(xml, "PREMISE_GUID", rs.getString("premise_guid"));
                        attr(xml, "KR_SUM", rs.getObject("kr_sum"));
                        attr(xml, "REP_TRF", rs.getObject("rep_trf"));
                        attr(xml, "REGN", rs.getString("regn"));
                        attr(xml, "SUM_T", rs.getObject("kr_st"));
                        attr(xml, "SUM_LGT", rs.getObject("lgt_kr"));
                        attr(xml, "RES_CODE", rs.getObject("res_code"));

                        newline(xml);
                    } catch (XMLStreamException e) {
                        throw new RuntimeException(e);
                    }
                },
                sessionId
        );
    }

    // =====================================================
    // ATTRIBUTE WRITER (NULL -> "")
    // =====================================================
    private void attr(XMLStreamWriter xml,
                      String name,
                      Object value) {

        try {
            xml.writeAttribute(
                    name,
                    value == null ? "" : String.valueOf(value)
            );
        } catch (XMLStreamException e) {
            throw new RuntimeException("XML write error", e);
        }
    }

    private void newline(XMLStreamWriter xml) {
        try {
            xml.writeCharacters("\n");
        } catch (XMLStreamException e) {
            throw new RuntimeException(e);
        }
    }

    private void indent(XMLStreamWriter xml) {
        try {
            xml.writeCharacters("  ");
        } catch (XMLStreamException e) {
            throw new RuntimeException(e);
        }
    }
}