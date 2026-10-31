package com.worktracker.ai;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class LocalAiImportDateResolver {

    private static final Pattern ISO = Pattern.compile(
            "^(\\d{4})-(\\d{1,2})-(\\d{1,2})(?!\\d)"
    );

    private static final Pattern NUMERIC = Pattern.compile(
            "^(?:Dt\\s+)?(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})(?!\\d)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DAY_MONTH_YEAR = Pattern.compile(
            "^(?:[\\p{L}]+\\s+)?(\\d{1,2})\\s+([\\p{L}]+)\\s+(\\d{4})(?!\\d)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private static final Pattern MONTH_DAY_YEAR = Pattern.compile(
            "^([\\p{L}]+)\\s+(\\d{1,2}),?\\s+(\\d{4})(?!\\d)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private LocalAiImportDateResolver() {
    }

    static String resolve(String[] lines, int sourceLine) {
        LocalDate activeDate = null;

        for (int index = 0; index < sourceLine && index < lines.length; index++) {
            String line = lines[index].strip();

            if (line.matches("[-=_*]{3,}")) {
                activeDate = null;
                continue;
            }

            LocalDate explicit = parseLeadingDate(line);

            if (explicit != null) {
                activeDate = explicit;
            }
        }

        return activeDate == null ? "" : activeDate.toString();
    }

    private static LocalDate parseLeadingDate(String line) {
        String text = line.replaceFirst("^#{1,6}\\s+", "").strip();

        Matcher iso = ISO.matcher(text);

        if (iso.find()) {
            return date(
                    Integer.parseInt(iso.group(1)),
                    Integer.parseInt(iso.group(2)),
                    Integer.parseInt(iso.group(3))
            );
        }

        Matcher numeric = NUMERIC.matcher(text);

        if (numeric.find()) {
            return date(
                    Integer.parseInt(numeric.group(3)),
                    Integer.parseInt(numeric.group(2)),
                    Integer.parseInt(numeric.group(1))
            );
        }

        Matcher dayMonth = DAY_MONTH_YEAR.matcher(text);

        if (dayMonth.find()) {
            return date(
                    Integer.parseInt(dayMonth.group(3)),
                    month(dayMonth.group(2)),
                    Integer.parseInt(dayMonth.group(1))
            );
        }

        Matcher monthDay = MONTH_DAY_YEAR.matcher(text);

        if (monthDay.find()) {
            return date(
                    Integer.parseInt(monthDay.group(3)),
                    month(monthDay.group(1)),
                    Integer.parseInt(monthDay.group(2))
            );
        }

        return null;
    }

    private static LocalDate date(int year, int month, int day) {
        try {
            return LocalDate.of(year, month, day);
        } catch (DateTimeException exception) {
            return null;
        }
    }

    private static int month(String value) {
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "jan", "january", "janar" -> 1;
            case "feb", "february", "shkurt" -> 2;
            case "mar", "march", "mars" -> 3;
            case "apr", "april", "prill" -> 4;
            case "may", "maj" -> 5;
            case "jun", "june", "qershor" -> 6;
            case "jul", "july", "korrik" -> 7;
            case "aug", "august", "gusht" -> 8;
            case "sep", "sept", "september", "shtator" -> 9;
            case "oct", "october", "tetor" -> 10;
            case "nov", "november", "nentor", "nëntor" -> 11;
            case "dec", "december", "dhjetor" -> 12;
            default -> 0;
        };
    }
}