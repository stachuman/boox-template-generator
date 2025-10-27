// Lightweight i18n helpers for month/weekday names (design mode)
// Mirrors src/einkpdf/i18n.py behavior for locales we support.

export type SupportedLocale = 'en' | 'pl' | 'de' | 'fr' | 'es' | 'it' | 'ja' | 'zh' | 'uk' | string;

function normLocale(locale?: SupportedLocale): 'en' | 'pl' | 'de' | 'fr' | 'es' | 'it' | 'ja' | 'zh' | 'uk' {
  if (!locale) return 'en';
  const l = String(locale).trim().toLowerCase();
  if (l.startsWith('pl')) return 'pl';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('it')) return 'it';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('uk')) return 'uk';
  return 'en';
}

export function getMonthNames(locale?: SupportedLocale, short = false): string[] {
  const loc = normLocale(locale);

  if (loc === 'pl') {
    const long = ['styczeń','luty','marzec','kwiecień','maj','czerwiec',
                  'lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
    const abbr = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
    return short ? abbr : long;
  }

  if (loc === 'de') {
    const long = ['Januar','Februar','März','April','Mai','Juni',
                  'Juli','August','September','Oktober','November','Dezember'];
    const abbr = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return short ? abbr : long;
  }

  if (loc === 'fr') {
    const long = ['janvier','février','mars','avril','mai','juin',
                  'juillet','août','septembre','octobre','novembre','décembre'];
    const abbr = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    return short ? abbr : long;
  }

  if (loc === 'es') {
    const long = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const abbr = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return short ? abbr : long;
  }

  if (loc === 'it') {
    const long = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                  'luglio','agosto','settembre','ottobre','novembre','dicembre'];
    const abbr = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
    return short ? abbr : long;
  }

  if (loc === 'ja') {
    const months = ['1月','2月','3月','4月','5月','6月',
                    '7月','8月','9月','10月','11月','12月'];
    return months;  // Japanese uses same format for short and long
  }

  if (loc === 'zh') {
    const months = ['1月','2月','3月','4月','5月','6月',
                    '7月','8月','9月','10月','11月','12月'];
    return months;  // Chinese uses same format for short and long
  }

  if (loc === 'uk') {
    const long = ['січень','лютий','березень','квітень','травень','червень',
                  'липень','серпень','вересень','жовтень','листопад','грудень'];
    const abbr = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
    return short ? abbr : long;
  }

  // English default
  const long = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
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
  } else if (loc === 'de') {
    full = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
    shortN = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    narrow = ['M','D','M','D','F','S','S'];
  } else if (loc === 'fr') {
    full = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
    shortN = ['lun','mar','mer','jeu','ven','sam','dim'];
    narrow = ['L','M','M','J','V','S','D'];
  } else if (loc === 'es') {
    full = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    shortN = ['lun','mar','mié','jue','vie','sáb','dom'];
    narrow = ['L','M','X','J','V','S','D'];
  } else if (loc === 'it') {
    full = ['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica'];
    shortN = ['lun','mar','mer','gio','ven','sab','dom'];
    narrow = ['L','M','M','G','V','S','D'];
  } else if (loc === 'ja') {
    full = ['月曜日','火曜日','水曜日','木曜日','金曜日','土曜日','日曜日'];
    shortN = ['月','火','水','木','金','土','日'];
    narrow = shortN;  // Japanese uses same format
  } else if (loc === 'zh') {
    full = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
    shortN = ['周一','周二','周三','周四','周五','周六','周日'];
    narrow = ['一','二','三','四','五','六','日'];
  } else if (loc === 'uk') {
    full = ['понеділок','вівторок','середа','четвер','п\'ятниця','субота','неділя'];
    shortN = ['Пн','Вт','Сер','Чт','Пт','Сб','Нд'];
    narrow = ['П','В','С','Ч','П','С','Н'];
  } else {  // English default
    full = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    shortN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    narrow = ['M','T','W','T','F','S','S'];
  }

  const base = style === 'full' ? full : (style === 'narrow' ? narrow : shortN);
  return start === 'sunday' ? base.slice(-1).concat(base.slice(0, -1)) : base;
}

