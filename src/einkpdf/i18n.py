"""
Simple i18n helpers for month and weekday names used by compilation and renderer.

Centralizes locale decisions so both phases stay consistent.
"""

from datetime import date as _date
from typing import List


def _norm(locale: str) -> str:
    if not locale:
        return "en"
    l = locale.strip().lower()
    if l.startswith("pl"):
        return "pl"
    return "en"


def get_month_names(locale: str, short: bool = False) -> List[str]:
    loc = _norm(locale)
    if loc == "pl":
        long = [
            "styczeń",
            "luty",
            "marzec",
            "kwiecień",
            "maj",
            "czerwiec",
            "lipiec",
            "sierpień",
            "wrzesień",
            "październik",
            "listopad",
            "grudzień",
        ]
        shortn = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]
        return shortn if short else long
    # default English
    long = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
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
    else:
        full = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        narrow = ["M", "T", "W", "T", "F", "S", "S"]
    base = full if style == "full" else (narrow if style == "narrow" else short)
    if start == "sunday":
        return base[-1:] + base[:-1]
    return base


def format_date_long(d: _date, locale: str) -> str:
    loc = _norm(locale)
    if loc == "pl":
        # Example: niedziela, 5 stycznia 2026
        wd = get_weekday_names(loc, style="full")[d.weekday()]
        mn = get_month_names(loc, short=False)[d.month - 1]
        return f"{wd}, {d.day} {mn} {d.year}"
    # English default: Wednesday, January 15, 2026
    wd = get_weekday_names(loc, style="full")[d.weekday()]
    mn = get_month_names(loc, short=False)[d.month - 1]
    return f"{wd}, {mn} {d.day}, {d.year}"

