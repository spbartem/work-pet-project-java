package ru.fkr.workpetproject.service;

import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;


import java.io.ByteArrayInputStream;
import java.io.IOException;
import org.springframework.transaction.annotation.Transactional;
import ru.fkr.workpetproject.dao.entity.RosreestrFullInfo;
import ru.fkr.workpetproject.dao.entity.RosreestrFullInfoSession;
import ru.fkr.workpetproject.repository.RosreestrFullInfoRepository;
import ru.fkr.workpetproject.repository.RosreestrFullInfoSessionRepository;

import javax.xml.parsers.DocumentBuilder;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class XmlParserService {
    private final DocumentBuilder documentBuilder;
    private final RosreestrFullInfoRepository rosreestrFullInfoRepository;
    private final RosreestrFullInfoSessionRepository rosreestrFullInfoSessionRepository;

    public XmlParserService(DocumentBuilder documentBuilder,
                            RosreestrFullInfoRepository rosreestrFullInfoRepository,
                            RosreestrFullInfoSessionRepository rosreestrFullInfoSessionRepository) {
        this.documentBuilder = documentBuilder;
        this.rosreestrFullInfoRepository = rosreestrFullInfoRepository;
        this.rosreestrFullInfoSessionRepository = rosreestrFullInfoSessionRepository;
    }

    @Transactional
    public void parseAndSaveRosreestrFullInfo(byte[] xmlData) throws IOException, SAXException {
        Long rosreestrFullInfoSessionId = parseAndSaveRosreestrFullInfoSession(xmlData);

        Document document = documentBuilder.parse(new ByteArrayInputStream(xmlData));
        NodeList nodeList = document.getElementsByTagName("right_record");
        List<RosreestrFullInfo> rosreestrFullInfoList = new ArrayList<>();

        for (int i = 0; i < nodeList.getLength(); i++)  {

            Element element = (Element) nodeList.item(i);
            RosreestrFullInfo rosreestrFullInfo = new RosreestrFullInfo();

            rosreestrFullInfo.setRosreestrFullInfoSession(rosreestrFullInfoSessionId);
            rosreestrFullInfo.setRegistrationDate(parseDateTime(element, "registration_date"));

            rosreestrFullInfo.setCancelDate(parseDateTime(element, "cancel_date"));

            Element rightType = (Element) element.getElementsByTagName("right_type").item(0);
            rosreestrFullInfo.setRightTypeCode(parseStringOrNull(rightType, "code"));
            rosreestrFullInfo.setRightTypeValue(parseStringOrNull(rightType, "value"));

            rosreestrFullInfo.setRightNumber(parseStringOrNull(element, "right_number"));

            NodeList shareDescriptionNode = element.getElementsByTagName("share_description");
            if (shareDescriptionNode.getLength() > 0) {
                String shareDescription = shareDescriptionNode.item(0).getTextContent();
                Pattern pattern = Pattern.compile("\\d+/\\d+");

                Matcher matcher = pattern.matcher(shareDescription);
                if (matcher.matches()) {
                    String[] split_share_description = shareDescription.split("/");
                    String numerator = split_share_description[0];
                    String denominator = split_share_description[1];
                    rosreestrFullInfo.setShareNumerator(split_share_description[0] == null ? null : Long.valueOf(numerator));
                    rosreestrFullInfo.setShareDenominator(split_share_description[1] == null ? null : Long.valueOf(denominator));
                } else {
                    rosreestrFullInfo.setShareNumerator(parseLongOrNull(element, "numerator"));
                    rosreestrFullInfo.setShareDenominator(parseLongOrNull(element, "denominator"));
                }
            } else {
                rosreestrFullInfo.setShareNumerator(parseLongOrNull(element, "numerator"));
                rosreestrFullInfo.setShareDenominator(parseLongOrNull(element, "denominator"));
            }

            Element rightHolder = (Element) element.getElementsByTagName("right_holder").item(0).getFirstChild();
            String rightHolderType = rightHolder.getTagName();
            if (rightHolderType.equals("individual")) {
                rosreestrFullInfo.setIsIndividual(true);
                rosreestrFullInfo.setLastName(parseStringOrNull(rightHolder, "surname"));
                rosreestrFullInfo.setFirstName(parseStringOrNull(rightHolder, "name"));
                rosreestrFullInfo.setSecondName(parseStringOrNull(rightHolder, "patronymic"));
                String birth_date = parseStringOrNull(rightHolder, "birth_date");
                rosreestrFullInfo.setBirthDate(birth_date == null ? null : LocalDate.parse(birth_date));
                rosreestrFullInfo.setBirthPlace(parseStringOrNull(rightHolder, "birth_place"));
            }

            if (rightHolderType.equals("legal_entity")) {
                rosreestrFullInfo.setIsIndividual(false);
                rosreestrFullInfo.setInn(parseStringOrNull(rightHolder, "inn"));
                rosreestrFullInfo.setOgrn(parseStringOrNull(rightHolder, "ogrn"));
                rosreestrFullInfo.setOwnerName(parseStringOrNull(rightHolder, "name"));
            }


            Element citizenship_country = (Element) element.getElementsByTagName("citizenship_country").item(0);
            rosreestrFullInfo.setCitizenshipCountryCode(citizenship_country == null ? null : parseStringOrNull(citizenship_country, "code"));
            rosreestrFullInfo.setCitizenshipCountryValue(citizenship_country == null ? null : parseStringOrNull(citizenship_country, "value"));

            rosreestrFullInfo.setSnils(parseStringOrNull(element, "snils"));

            Element identity_doc = (Element) element.getElementsByTagName("identity_doc").item(0);

            if (identity_doc != null) {
                Element document_code = (Element) identity_doc.getElementsByTagName("document_code").item(0);
                rosreestrFullInfo.setIdentityDocCode(parseStringOrNull(document_code, "code"));
                rosreestrFullInfo.setIdentityDocValue(parseStringOrNull(document_code, "value"));
                rosreestrFullInfo.setDocumentName(parseStringOrNull(identity_doc, "document_name"));
                rosreestrFullInfo.setDocumentSeries(parseStringOrNull(identity_doc, "document_series"));
                rosreestrFullInfo.setDocumentNumber(parseStringOrNull(identity_doc, "document_number"));
                String documentDate = parseStringOrNull(identity_doc, "document_date");
                rosreestrFullInfo.setDocumentDate(documentDate == null ? null : LocalDate.parse(documentDate));
                rosreestrFullInfo.setDocumentIssuer(parseStringOrNull(identity_doc, "document_issuer") );
            }

            Element changes = (Element) element.getElementsByTagName("changes").item(0);

            if (changes != null) {
                rosreestrFullInfo.setChangeRecordNumber(parseStringOrNull(changes, "change_record_number"));
            }

            rosreestrFullInfo.setMailingAddress(parseStringOrNull(element, "mailing_addess"));

            rosreestrFullInfoList.add(rosreestrFullInfo);
        }

        rosreestrFullInfoRepository.saveAll(rosreestrFullInfoList);
    }

    public Long parseAndSaveRosreestrFullInfoSession(byte[] xmlData) throws IOException, SAXException {

        Document document = documentBuilder.parse(new ByteArrayInputStream(xmlData));
        NodeList nodeList = document.getElementsByTagName("room_record");
        Element element = (Element) nodeList.item(0);
        Element details_statement = (Element) document.getElementsByTagName("details_statement").item(0);
        Element group_top_requisites = (Element) details_statement.getElementsByTagName("group_top_requisites").item(0);
        RosreestrFullInfoSession session = new RosreestrFullInfoSession();

        String statementDateFormation = parseStringOrNull(group_top_requisites, "date_formation");
        session.setStatementDateFormation(statementDateFormation == null ? null : LocalDate.parse(statementDateFormation));
        session.setStatementRegistrationNumber(parseStringOrNull(group_top_requisites, "registration_number"));
        session.setCadNum(parseStringOrNull(element, "cad_number"));
//        session.setArea(element.getElementsByTagName("area").item(0).getTextContent());
        session.setOkato(parseStringOrNull(element, "okato"));
        session.setKladr(parseStringOrNull(element, "kladr"));
        session.setTypeStreet(parseStringOrNull(element, "type_street"));
        session.setNameStreet(parseStringOrNull(element, "name_street"));
        session.setTypeLevel1(parseStringOrNull(element, "type_level1"));
        session.setNameLevel1(parseStringOrNull(element, "name_level1"));
        session.setTypeLevel2(parseStringOrNull(element, "type_level2"));
        session.setNameLevel2(parseStringOrNull(element, "name_level2"));
        session.setTypeLevel3(parseStringOrNull(element, "type_level3"));
        session.setNameLevel3(parseStringOrNull(element, "name_level3"));
        session.setTypeApartment(parseStringOrNull(element, "type_apartment"));
        session.setNameApartment(parseStringOrNull(element,"name_apartment"));
        session.setReadableAddress(parseStringOrNull(element, "readable_address"));
        session.setDateCadastral(parseStringOrNull(element, "date_cadastral"));

        RosreestrFullInfoSession savedSession = rosreestrFullInfoSessionRepository.save(session);
        return savedSession.getRosreestr_full_info_session_id();
    }

    private LocalDate parseDateTime(Element element, String tagName) {

        Node valueDateTime = element.getElementsByTagName(tagName).item(0);
        return valueDateTime == null ? null : OffsetDateTime.parse(valueDateTime.getTextContent()).toLocalDate();
    }

    private String parseStringOrNull(Element element, String tagName) {

        Node value = element.getElementsByTagName(tagName).item(0);
        return value == null ? null : value.getTextContent();
    }

    private Long parseLongOrNull(Element element, String tagName) {
        Node value = element.getElementsByTagName(tagName).item(0);
        return value == null ? null : Long.valueOf(value.getTextContent());
    }
}
