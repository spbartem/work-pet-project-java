package ru.fkr.workpetproject.dao.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Data
@Entity
@Table(name = "rosreestr_full_info")
public class RosreestrFullInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rosreestr_full_info_session_id")
    private Long rosreestrFullInfoSession;

    @Column(name = "registration_date")
    private LocalDate registrationDate;

    @Column(name = "right_type_code")
    private String rightTypeCode;

    @Column(name = "right_type_value")
    private String rightTypeValue;

    @Column(name = "right_number")
    private String rightNumber;

    @Column(name = "share_numerator")
    private Long shareNumerator;

    @Column(name = "share_denominator")
    private Long shareDenominator;

    @Column(name = "is_individual")
    private Boolean isIndividual;

    @Column(name = "inn")
    private String inn;

    @Column(name = "ogrn")
    private String ogrn;

    @Column(name = "owner_name")
    private String ownerName;

    @Column(name = "lastname")
    private String lastName;

    @Column(name = "firstname")
    private String firstName;

    @Column(name = "secondname")
    private String secondName;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "birth_place")
    private String birthPlace;

    @Column(name = "citizenship_country_code")
    private String citizenshipCountryCode;

    @Column(name = "citizenship_country_value")
    private String citizenshipCountryValue;

    @Column(name = "snils")
    private String snils;

    @Column(name = "identity_doc_code")
    private String identityDocCode;

    @Column(name = "identity_doc_value")
    private String identityDocValue;

    @Column(name = "document_name")
    private String documentName;

    @Column(name = "document_series")
    private String documentSeries;

    @Column(name = "document_number")
    private String documentNumber;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @Column(name = "document_issuer")
    private String documentIssuer;

    @Column(name = "mailing_address")
    private String mailingAddress;

    @Column(name = "cancel_date")
    private LocalDate cancelDate;

    @Column(name = "change_record_number")
    private String changeRecordNumber;
}
