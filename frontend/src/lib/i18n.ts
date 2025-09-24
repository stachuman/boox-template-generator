// Lightweight i18n helpers for month/weekday names (design mode)
// Mirrors src/einkpdf/i18n.py behavior for locales we support.

export type SupportedLocale = 'en' | 'pl' | string;

function normLocale(locale?: SupportedLocale): 'en' | 'pl' {
  if (!locale) return 'en';
  const l = String(locale).trim().toLowerCase();
  if (l.startsWith('pl')) return 'pl';
  return 'en';
}

export function getMonthNames(locale?: SupportedLocale, short = false): string[] {
  const loc = normLocale(locale);
  if (loc === 'pl') {
    const long = [
      'styczeń','luty','marzec','kwiecień','maj','czerwiec',
      'lipiec','sierpień','wrzesień','październik','listopad','grudzień'
    ];
    const abbr = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
    return short ? abbr : long;
  }
  const long = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const abbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return short ? abbr : long;
}

export function getWeekdayNames(locale?: SupportedLocale, style: 'full'|'short'|'narrow' = 'short', start: 'monday'|'sunday' = 'monday'): string[] {
  const loc = normLocale(locale);
  let full: string[], shortN: string[], narrow: string[];
  if (loc === 'pl') {
    full = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
    shortN = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd'];
    narrow = ['P','W','Ś','C','P','S','N'];
  } else {
    full = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    shortN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    narrow = ['M','T','W','T','F','S','S'];
  }
  const base = style === 'full' ? full : (style === 'narrow' ? narrow : shortN);
  return start === 'sunday' ? base.slice(-1).concat(base.slice(0, -1)) : base;
}

