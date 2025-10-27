"""
Simple i18n helpers for month and weekday names used by compilation and renderer.

Centralizes locale decisions so both phases stay consistent.
"""

from datetime import date as _date
from typing import List


def _norm(locale: str) -> str:
    """Normalize locale string to supported locale code."""
    if not locale:
        return "en"
    l = locale.strip().lower()
    if l.startswith("pl"):
        return "pl"
    if l.startswith("de"):
        return "de"
    if l.startswith("fr"):
        return "fr"
    if l.startswith("es"):
        return "es"
    if l.startswith("it"):
        return "it"
    if l.startswith("ja"):
        return "ja"
    if l.startswith("zh"):
        return "zh"
    if l.startswith("uk"):
        return "uk"
    return "en"


def get_month_names(locale: str, short: bool = False) -> List[str]:
    loc = _norm(locale)

    if loc == "pl":
        long = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
                "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"]
        shortn = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]
        return shortn if short else long

    if loc == "de":
        long = ["Januar", "Februar", "März", "April", "Mai", "Juni",
                "Juli", "August", "September", "Oktober", "November", "Dezember"]
        shortn = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
        return shortn if short else long

    if loc == "fr":
        long = ["janvier", "février", "mars", "avril", "mai", "juin",
                "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
        shortn = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"]
        return shortn if short else long

    if loc == "es":
        long = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        shortn = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
        return shortn if short else long

    if loc == "it":
        long = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
                "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
        shortn = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
        return shortn if short else long

    if loc == "ja":
        long = ["1月", "2月", "3月", "4月", "5月", "6月",
                "7月", "8月", "9月", "10月", "11月", "12月"]
        shortn = long  # Japanese uses same format for short
        return shortn if short else long

    if loc == "zh":
        long = ["1月", "2月", "3月", "4月", "5月", "6月",
                "7月", "8月", "9月", "10月", "11月", "12月"]
        shortn = long  # Chinese uses same format for short
        return shortn if short else long

    if loc == "uk":
        long = ["січень", "лютий", "березень", "квітень", "травень", "червень",
                "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"]
        shortn = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"]
        return shortn if short else long

    # Default English
    long = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"]
    shortn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return shortn if short else long


def get_weekday_names(locale: str, style: str = "short", start: str = "monday") -> List[str]:
    """Return list of 7 weekday names in the requested style starting on given day.

    style: 'full' | 'short' | 'narrow'
    start: 'monday' | 'sunday'
    """
    loc = _norm(locale)

    if loc == "pl":
        full = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]
        short = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"]
        narrow = ["P", "W", "Ś", "C", "P", "S", "N"]
    elif loc == "de":
        full = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
        short = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
        narrow = ["M", "D", "M", "D", "F", "S", "S"]
    elif loc == "fr":
        full = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        short = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]
        narrow = ["L", "M", "M", "J", "V", "S", "D"]
    elif loc == "es":
        full = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
        short = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
        narrow = ["L", "M", "X", "J", "V", "S", "D"]
    elif loc == "it":
        full = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
        short = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]
        narrow = ["L", "M", "M", "G", "V", "S", "D"]
    elif loc == "ja":
        full = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"]
        short = ["月", "火", "水", "木", "金", "土", "日"]
        narrow = short  # Japanese uses same format
    elif loc == "zh":
        full = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        short = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        narrow = ["一", "二", "三", "四", "五", "六", "日"]
    elif loc == "uk":
        full = ["понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота", "неділя"]
        short = ["Пн", "Вт", "Сер", "Чт", "Пт", "Сб", "Нд"]
        narrow = ["П", "В", "С", "Ч", "П", "С", "Н"]
    else:  # English default
        full = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        narrow = ["M", "T", "W", "T", "F", "S", "S"]

    base = full if style == "full" else (narrow if style == "narrow" else short)
    if start == "sunday":
        return base[-1:] + base[:-1]
    return base


def format_date_long(d: _date, locale: str) -> str:
    """Format date in long form according to locale conventions."""
    loc = _norm(locale)
    wd = get_weekday_names(loc, style="full")[d.weekday()]
    mn = get_month_names(loc, short=False)[d.month - 1]

    if loc in ("pl", "de", "fr", "es", "it", "uk"):
        # European format: weekday, day month year
        return f"{wd}, {d.day} {mn} {d.year}"
    elif loc in ("ja", "zh"):
        # Asian format: year年month月day日 (weekday)
        if loc == "ja":
            return f"{d.year}年{d.month}月{d.day}日 ({wd})"
        else:  # zh
            return f"{d.year}年{d.month}月{d.day}日 {wd}"
    else:  # English and default
        # US/UK format: weekday, month day, year
        return f"{wd}, {mn} {d.day}, {d.year}"

