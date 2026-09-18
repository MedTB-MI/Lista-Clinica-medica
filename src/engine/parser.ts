import {
  LAB_ALIASES,
  LAB_LABELS,
  MICRO_TYPES,
  SUPPLEMENTAL_ALIASES,
} from './constants';
import type { LabItem, LabKey, ParsedCompactList, SupplementalEntry } from './types';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const compactWhitespace = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeDecimalForMath = (value: string): number | null => {
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

export const containsIntervention = (value: string): boolean =>
  /(?:\+\s*(?:\d+\s*)?(?:UGR|UP|U\s*GR|GR)\b|\(\s*\+\s*(?:K|P|Mg)\s*\)|\+\s*(?:K|P|Mg)\b)/i.test(
    value,
  );

const normalizeLabValue = (key: LabKey, value: string): string => {
  let normalized = compactWhitespace(value)
    .replace(/^\s*:\s*/, '')
    .replace(/[;,]+$/, '')
    .replace(/\s+\./g, '.')
    .trim();

  if (key === 'hep' && /^(?:s\s*\/\s*p|sp)$/i.test(normalized)) return 'sp';
  if (key === 'coag' && /^(?:s\s*\/\s*p|sp)$/i.test(normalized)) return 'sp';
  return normalized;
};

const historicalLabel = (key: LabKey, source: string, value: string): string => {
  if (key === 'u' && /^Urea/i.test(source)) return 'Urea';
  if (key === 'hep' && /^Hepato/i.test(source) && !/^(?:s\s*\/\s*p|sp)$/i.test(value)) {
    return 'Hepato:';
  }
  return LAB_LABELS[key];
};

const canonicalSupplementalKey = (label: string, text: string): string => {
  const folded = label.toLocaleUpperCase('es');
  if (/^(?:TC TX C\/|TCTX|TAC TX|TC TX)/.test(folded)) {
    return /\bTEP\b/i.test(text) || /tromboemboli/i.test(text) ? 'TC_TX_TEP' : 'TC_TX';
  }
  if (/^(?:TC SNC|TCSNC|TC CER)/.test(folded)) return 'TC_SNC';
  if (folded.startsWith('TC AP')) return 'TC_AP';
  if (folded.startsWith('ANGIOTC')) return 'ANGIOTC';
  if (/^RMN (?:SNC|CER)/.test(folded)) return 'RMN_SNC';
  if (folded.startsWith('RMN ÓRBITA')) return 'RMN_ORBITA';
  if (folded.startsWith('RMN COL')) return 'RMN_COL';
  if (/^RX ?TX/.test(folded)) return 'RX_TX';
  if (folded.startsWith('ECO♥')) return 'ECO_CARDIO';
  if (folded.startsWith('ECORV')) return 'ECO_RV';
  if (folded.startsWith('ECOVC')) return 'ECO_VC';
  if (folded.startsWith('ECO ABD')) return 'ECO_ABD';
  return folded.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
};

const parseSupplemental = (text: string): { entries: SupplementalEntry[]; firstIndex: number } => {
  const aliases = [...SUPPLEMENTAL_ALIASES].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const regex = new RegExp(`(?:^|\\s|(?<=[.;]))\\s*(${aliases.join('|')})(?=\\s|:|\\d|$)`, 'giu');
  const matches = [...text.matchAll(regex)];
  if (!matches.length) return { entries: [], firstIndex: text.length };

  const entries: SupplementalEntry[] = matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const entryText = compactWhitespace(text.slice(start, end)).replace(/^\.+\s*/, '').replace(/\s+$/, '');
    const label = match[1];
    const upper = label.toLocaleUpperCase('es').replace(/\s+/g, ' ');
    const sampleType = upper === 'UROC' ? 'UC' : upper;
    const isMicro = MICRO_TYPES.has(sampleType);
    const date = entryText.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/)?.[1];
    return {
      key: isMicro ? `${sampleType}:${date ?? ''}` : canonicalSupplementalKey(label, entryText),
      type: isMicro ? 'micro' : 'study',
      text: entryText,
      sampleType: isMicro ? sampleType : undefined,
      date,
      pending: isMicro ? /\bpendiente\b/i.test(entryText) : undefined,
    };
  });

  return { entries, firstIndex: matches[0].index ?? text.length };
};

const labMatcher = (): RegExp => {
  const aliases = LAB_ALIASES.map((entry) => entry.pattern);
  return new RegExp(`(?:^|\\s)(${aliases.join('|')})(?=\\s|:|<|$)`, 'giu');
};

const keyForAlias = (alias: string): LabKey | null => {
  for (const entry of LAB_ALIASES) {
    if (new RegExp(`^(?:${entry.pattern})$`, 'iu').test(alias.trim())) return entry.key;
  }
  return null;
};

const parseDifferential = (key: LabKey, value: string): LabItem['differential'] => {
  if (key !== 'gb') return undefined;
  const neutrophilMatch = value.match(
    /(?:\bN(?:eutrofilos?)?\s*)(\d+(?:[.,]\d+)?)\s*%|\b(\d+(?:[.,]\d+)?)\s*%\s*N\b/i,
  );
  const neutrophils = neutrophilMatch?.[1] ?? neutrophilMatch?.[2];
  const blasts = value.match(/(?:\bB\s*|\bBlastos?\s*)(\d+(?:[.,]\d+)?)\s*%/i)?.[1];
  if (!neutrophils && !blasts) return undefined;
  return { neutrophils, blasts };
};

export const parseCompactList = (input: string): ParsedCompactList => {
  const text = compactWhitespace(input);
  if (!text) return { labs: [], supplemental: [], unparsedPrefix: '' };

  const supplementalResult = parseSupplemental(text);
  const labText = text.slice(0, supplementalResult.firstIndex).trim();
  const matches = [...labText.matchAll(labMatcher())];
  const labs: LabItem[] = [];

  matches.forEach((match, index) => {
    const key = keyForAlias(match[1]);
    if (!key) return;
    const fullStart = match.index ?? 0;
    const leadingSpace = match[0].length - match[0].trimStart().length;
    const labelStart = fullStart + leadingSpace;
    const valueStart = labelStart + match[1].length;
    const nextStart =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? labText.length) +
          (matches[index + 1][0].length - matches[index + 1][0].trimStart().length)
        : labText.length;
    let value = normalizeLabValue(key, labText.slice(valueStart, nextStart));
    if (!value) return;
    const label = historicalLabel(key, match[1], value);
    const differential = parseDifferential(key, value);
    if (key === 'gb' && differential) {
      const count = value.match(/^[<>]?\s*\d+(?:[.,]\d+)?\s*m?/i)?.[0].replace(/\s+/g, '');
      if (count) {
        const normalizedCount = count.endsWith('m') ? count : `${count}m`;
        if (differential.blasts) {
          value = `${normalizedCount} B${differential.blasts}%`;
        } else if (differential.neutrophils) {
          value = `${normalizedCount} ${differential.neutrophils}%N`;
        }
      }
    }
    labs.push({
      key,
      label,
      value,
      raw: `${label} ${value}`,
      hasIntervention: containsIntervention(value),
      differential,
    });
  });

  const firstLabIndex = matches[0]?.index ?? supplementalResult.firstIndex;
  return {
    labs,
    supplemental: supplementalResult.entries,
    unparsedPrefix: compactWhitespace(text.slice(0, firstLabIndex)),
  };
};

interface RowValue {
  value: string;
  abnormal: boolean;
}

const markdownRow = (input: string, labelPattern: string): RowValue | null => {
  const rowRegex = new RegExp(
    `^.*(?:${labelPattern}).*?\\*\\*\\s*([<>]?\\d+(?:[.,]\\d+)?)\\s*\\*\\*.*$`,
    'imu',
  );
  const match = input.match(rowRegex);
  if (!match) return null;
  return { value: match[1], abnormal: /\*\*\s*[↑↓]\s*\*\*/u.test(match[0]) };
};

const plainValue = (input: string, labelPattern: string): RowValue | null => {
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:${labelPattern})\\s*[:|]?\\s*([<>]?\\d+(?:[.,]\\d+)?)`,
    'imu',
  );
  const match = input.match(regex);
  return match ? { value: match[1], abnormal: false } : null;
};

const reportValue = (input: string, labelPattern: string): RowValue | null =>
  markdownRow(input, labelPattern) ?? plainValue(input, labelPattern);

const item = (key: LabKey, value: string, abnormal = false): LabItem => ({
  key,
  label: LAB_LABELS[key],
  value,
  raw: `${LAB_LABELS[key]} ${value}`,
  abnormal,
  hasIntervention: containsIntervention(value),
});

const compactCount = (value: string): string => {
  return `${value}m`;
};

export const parseRawLabReport = (input: string): LabItem[] => {
  if (!input.trim()) return [];
  const isReport =
    /HEMOGRAMA|RECUENTO DE GLOBULOS|IONOGRAMA EN SANGRE|CREATININA EN SANGRE/i.test(input) ||
    /(?:^|\n)\s*BD\s*[:|]?\s*[<>]?\d/im.test(input);
  if (!isReport) return parseCompactList(input).labs;

  const output: LabItem[] = [];
  const add = (key: LabKey, row: RowValue | null, transform?: (value: string) => string): void => {
    if (!row) return;
    output.push(item(key, transform ? transform(row.value) : row.value, row.abnormal));
  };

  add('hto', reportValue(input, 'HEMATOCRITO'));
  add('hb', reportValue(input, 'HEMOGLOBINA(?:\\s*\\||\\s{2,})'));

  const gb = reportValue(input, 'RECUENTO DE GLOBULOS BLANCOS');
  const neutrophils = reportValue(input, 'NEUTROFILOS(?:\\s*\\||\\s{2,})');
  const blasts = reportValue(input, 'BLASTOS');
  if (gb) {
    let gbValue = compactCount(gb.value);
    const differential: LabItem['differential'] = {};
    if (blasts && normalizeDecimalForMath(blasts.value) !== 0) {
      gbValue = `${gbValue} B${blasts.value}%`;
      differential.blasts = blasts.value;
    }
    output.push({
      ...item('gb', gbValue, gb.abnormal || Boolean(blasts?.abnormal)),
      differential: Object.keys(differential).length ? differential : undefined,
    });
  }

  add('plaq', reportValue(input, 'PLAQUETAS RECUENTO'), compactCount);
  add('u', reportValue(input, 'UREA EN SANGRE'));
  add('cr', reportValue(input, 'CREATININA EN SANGRE'));

  const na = reportValue(input, 'SODIO');
  const k = reportValue(input, 'POTASIO');
  const cl = reportValue(input, 'CLORO');
  if (na && k && cl) {
    output.push(item('iono', `${na.value}/${k.value}/${cl.value}`, na.abnormal || k.abnormal || cl.abnormal));
  }

  add('ac_urico', reportValue(input, 'ACIDO URICO EN SANGRE'));
  add('ca', reportValue(input, 'CALCIO EN SANGRE'));
  add('p', reportValue(input, 'FOSFORO EN SANGRE'));
  add('mg', reportValue(input, 'MAGNESIO EN SANGRE'));

  const bd = reportValue(input, 'BILIRRUBINA DIRECTA|BD');
  const bt = reportValue(input, 'BILIRRUBINA TOTAL|BT');
  const got = reportValue(input, 'ASPARTATO AMINOTRANSFERASA|ASAT-GOT|GOT');
  const gpt = reportValue(input, 'ALANINA AMINOTRANSFERASA|ALAT-GPT|GPT');
  const fa = reportValue(input, 'FOSFATASA ALCALINA SERICA|FA');
  const ggt = reportValue(input, 'GAMMA GLUTAMIL TRANSFERASA|GGT');
  const proteins = reportValue(input, 'PROTEINAS TOTALES');
  const albumin = reportValue(input, 'ALBUMINA');
  const hepRows = [bd, bt, got, gpt, fa];
  const extendedHepRows = [...hepRows, ggt, proteins, albumin];
  const hasExtendedHepatogram = extendedHepRows.every((row) => row !== null);
  if (hepRows.every((row) => row !== null)) {
    const limits = [0.3, 1.2, 32, 33, 104];
    const abnormal = hepRows.some((row, index) => {
      const numeric = row ? normalizeDecimalForMath(row.value) : null;
      return Boolean(row?.abnormal) || (numeric !== null && numeric > limits[index]);
    });
    const extendedAbnormal = hasExtendedHepatogram && extendedHepRows.some((row) => row?.abnormal);
    const value = hasExtendedHepatogram
      ? extendedHepRows.map((row) => row?.value).join('/')
      : abnormal
        ? hepRows.map((row) => row?.value).join('/')
        : 'sp';
    output.push(item('hep', value, abnormal || extendedAbnormal));
  }

  const kptt = reportValue(input, 'TIEMPO DE TROMBOPLASTINA PARCIAL|KPTT');
  const tp = reportValue(input, 'TIEMPO DE PROTROMBINA');
  const rin = reportValue(input, 'R\\.I\\.N\\.|RIN');
  const fibrinogen = reportValue(input, 'FIBRINOGENO');
  const coagRows = [kptt, tp, rin, fibrinogen].filter((row): row is RowValue => row !== null);
  if (coagRows.length >= 3) {
    const abnormal = coagRows.some((row) => row.abnormal);
    const value = abnormal
      ? [
          kptt ? `kPTT ${kptt.value}seg` : '',
          tp ? `TP ${tp.value}%` : '',
          rin ? `RIN ${rin.value}` : '',
          fibrinogen?.abnormal ? `Fibrinogeno ${fibrinogen.value}` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : 'sp';
    output.push(item('coag', value, abnormal));
  }

  add('pcr', reportValue(input, 'PROTEINA C REACTIVA|PCR'));
  add('ldh', reportValue(input, 'LACTATO DESHIDROGENASA|LDH'));
  if (!hasExtendedHepatogram) {
    add('alb', albumin);
    add('prot', proteins);
  }

  if (neutrophils && !blasts && /^\s*N\s*\d/i.test(input.trim())) {
    const gbItem = output.find((candidate) => candidate.key === 'gb');
    if (gbItem) {
      gbItem.value = `${gbItem.value} ${neutrophils.value}%N`;
      gbItem.raw = `GB ${gbItem.value}`;
      gbItem.differential = { neutrophils: neutrophils.value };
    }
  }

  return output;
};

export const normalizeCanonicalEntry = (entry: string): string =>
  compactWhitespace(entry)
    .replace(/\bHepato\s+s\s*\/\s*p\b/gi, 'Hep sp')
    .replace(/\bHep\s+s\s*\/\s*p\b/gi, 'Hep sp')
    .replace(/\bHepato\s+sp\b/gi, 'Hep sp')
    .replace(/\bs\s*\/\s*TEP\b/gi, 'sin TEP')
    .replace(/\bneg(?:ativo)?\s+TEP\b/gi, 'sin TEP');

export const parseSupplementalEntries = (input: string): SupplementalEntry[] =>
  parseSupplemental(compactWhitespace(input)).entries;
