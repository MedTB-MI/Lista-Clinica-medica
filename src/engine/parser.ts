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
  if (key === 'prot' && /^PrT/i.test(source)) return 'PrT';
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
  const blastPrefix = value.match(/(?:\bB\s*|\bBlastos?\s*)(\d+(?:[.,]\d+)?)\s*%/i)?.[1];
  const blastSuffix = value.match(/\b(\d+(?:[.,]\d+)?)\s*%\s*B\b/i)?.[1];
  const blasts = blastPrefix ?? blastSuffix;
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

interface PlainReportSection {
  label: string;
  lines: string[];
}

const REPORT_ANALYTE_PATTERNS = [
  'RECUENTO DE GL[OÓ]BULOS BLANCOS',
  'RECUENTO DE PLAQUETAS',
  'PLAQUETAS RECUENTO',
  'PLAQUETAS',
  'HEMATOCRITO',
  'HEMOGLOBINA',
  'NEUTR[OÓ]FILOS',
  'BLASTOS',
  'UREA(?: EN SANGRE)?',
  'CREATININA(?: EN SANGRE)?',
  'SODIO',
  'POTASIO',
  'CLORO',
  '[ÁA]CIDO [ÚU]RICO EN SANGRE',
  'CALCIO I[OÓ]NICO',
  'CALCIO EN SANGRE',
  'CAI',
  'F[OÓ]SFORO(?: EN SANGRE)?',
  'MAGNESIO(?: EN SANGRE)?',
  'BILIRRUBINA DIRECTA',
  'BILIRRUBINA TOTAL',
  'ASPARTATO AMINOTRANSFERASA',
  'ALANINA AMINOTRANSFERASA',
  'FOSFATASA ALCALINA SERICA',
  'GAMMA GLUTAMIL TRANSFERASA',
  'ASAT-GOT',
  'ALAT-GPT',
  'GOT',
  'GPT',
  'AST',
  'ALT',
  'FAL',
  'FA',
  'GGT',
  'BD',
  'BT',
  'TIEMPO DE TROMBOPLASTINA PARCIAL',
  'TIEMPO DE PROTROMBINA',
  'R\\.I\\.N\\.',
  'RIN',
  'KPTT',
  'FIBRIN[OÓ]GENO',
  'PROTE[IÍ]NA C REACTIVA',
  'LACTATO DESHIDROGENASA',
  'PROTE[IÍ]NAS TOTALES',
  'ALB[UÚ]MINA',
  'TACROL(?:EMIA)?',
  'PCR',
  'LDH',
  'GB',
];

const REPORT_SECTION_HEADER = /^(?:HEMOGRAMA|HEPATOGRAMA|IONOGRAMA(?: EN SANGRE)?|COAGULOGRAMA|SERIE (?:ERITROCITARIA|LEUCOCITARIA|PLAQUETARIA)|QUIMICA|QUÍMICA)$/iu;

const reportAnalyteHeader = new RegExp(
  `^\\s*(?:\\|\\s*)?(${REPORT_ANALYTE_PATTERNS.join('|')})(?:(?:\\s*[:|]\\s*|\\s+)(.*))?$`,
  'iu',
);

const splitPlainReportSections = (input: string): PlainReportSection[] => {
  const sections: PlainReportSection[] = [];
  let current: PlainReportSection | null = null;

  input.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const analyte = line.match(reportAnalyteHeader);
    if (analyte) {
      current = { label: analyte[1].trim(), lines: [] };
      const inline = (analyte[2] ?? '').trim();
      if (inline) current.lines.push(inline);
      sections.push(current);
      return;
    }
    if (REPORT_SECTION_HEADER.test(line)) {
      current = null;
      return;
    }
    if (current) current.lines.push(rawLine);
  });

  return sections;
};

const REFERENCE_RANGE = /^[<>]?\s*-?\d+(?:[.,]\d+)?\s*(?:-|–|—|a)\s*[<>]?\s*-?\d+(?:[.,]\d+)?$/iu;
const RESULT_WITH_OPTIONAL_UNIT = /^\*{0,2}\s*([<>]?\s*-?\d+(?:[.,]\d+)?)\s*\*{0,2}\s*(?:[↑↓]\s*)?(?:(?:%|g\s*\/\s*d[lL]|mg\s*\/\s*d[lL]|mEq\s*\/\s*[lL]|mmol\s*\/\s*[lL]|mil(?:lones)?\s*\/\s*mm3|UI\s*\/\s*[lL]|seg|pg|f[lL])\s*)?(?:[<>]?\s*-?\d+(?:[.,]\d+)?\s*(?:-|–|—|a)\s*[<>]?\s*-?\d+(?:[.,]\d+)?)?$/iu;

const valueFromPlainSection = (section: PlainReportSection): RowValue | null => {
  for (const rawLine of section.lines) {
    const line = rawLine
      .trim()
      .replace(/^\|\s*/, '')
      .replace(/\s*\|$/, '')
      .trim();
    if (!line) continue;
    if (/^(?:m[eé]todo|resultado\s+confirmado)\s*:?/iu.test(line)) continue;
    if (/RESULTADO\s+CR[IÍ]TICO/iu.test(line)) continue;
    if (/^[↑↓]+$/u.test(line)) continue;
    if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/u.test(line)) continue;
    if (REFERENCE_RANGE.test(line)) continue;

    const match = line.match(RESULT_WITH_OPTIONAL_UNIT);
    if (!match) continue;
    return {
      value: match[1].replace(/\s+/g, ''),
      abnormal: section.lines.some((candidate) => /[↑↓]/u.test(candidate)),
    };
  }
  return null;
};

const markdownRow = (input: string, labelPattern: string): RowValue | null => {
  const rowRegex = new RegExp(
    `^\\s*\\|?\\s*(?:${labelPattern})\\s*\\|.*?\\*\\*\\s*([<>]?\\d+(?:[.,]\\d+)?)\\s*\\*\\*.*$`,
    'imu',
  );
  const match = input.match(rowRegex);
  if (!match) return null;
  return { value: match[1], abnormal: /\*\*\s*[↑↓]\s*\*\*/u.test(match[0]) };
};

const plainValue = (
  input: string,
  labelPattern: string,
  sections = splitPlainReportSections(input),
): RowValue | null => {
  const label = new RegExp(`^(?:${labelPattern})$`, 'iu');
  const section = sections.find((candidate) => label.test(candidate.label));
  return section ? valueFromPlainSection(section) : null;
};

const reportValue = (
  input: string,
  labelPattern: string,
  sections?: PlainReportSection[],
): RowValue | null => markdownRow(input, labelPattern) ?? plainValue(input, labelPattern, sections);

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
  const plainSections = splitPlainReportSections(input);
  const isReport =
    /HEMOGRAMA|RECUENTO DE GL[OÓ]BULOS|RECUENTO DE PLAQUETAS|PLAQUETAS RECUENTO|IONOGRAMA EN SANGRE|UREA EN SANGRE|CREATININA EN SANGRE|PROTE[IÍ]NAS TOTALES|CALCIO I[OÓ]NICO|F[OÓ]SFORO|MAGNESIO|BLASTOS/i.test(input) ||
    /(?:^|\n)\s*BD\s*[:|]?\s*[<>]?\d/im.test(input) ||
    (/m[eé]todo\s*:/iu.test(input) && plainSections.length > 0);
  if (!isReport) return parseCompactList(input).labs;

  const read = (labelPattern: string): RowValue | null =>
    reportValue(input, labelPattern, plainSections);

  const output: LabItem[] = [];
  const add = (key: LabKey, row: RowValue | null, transform?: (value: string) => string): void => {
    if (!row) return;
    output.push(item(key, transform ? transform(row.value) : row.value, row.abnormal));
  };

  add('hto', read('HEMATOCRITO'));
  add('hb', read('HEMOGLOBINA'));

  const gb = read('RECUENTO DE GL[OÓ]BULOS BLANCOS|GB');
  const neutrophils = read('NEUTR[OÓ]FILOS');
  const blasts = read('BLASTOS');
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

  add('plaq', read('PLAQUETAS RECUENTO|RECUENTO DE PLAQUETAS|PLAQUETAS'), compactCount);
  add('u', read('UREA(?: EN SANGRE)?'));
  add('cr', read('CREATININA(?: EN SANGRE)?'));

  const na = read('SODIO');
  const k = read('POTASIO');
  const cl = read('CLORO');
  if (na && k && cl) {
    output.push(item('iono', `${na.value}/${k.value}/${cl.value}`, na.abnormal || k.abnormal || cl.abnormal));
  }

  add('ac_urico', read('[ÁA]CIDO [ÚU]RICO EN SANGRE'));
  add('cai', read('CALCIO I[OÓ]NICO|CAI'));
  add('ca', read('CALCIO EN SANGRE'));
  add('p', read('F[OÓ]SFORO(?: EN SANGRE)?'));
  add('mg', read('MAGNESIO(?: EN SANGRE)?'));

  const bd = read('BILIRRUBINA DIRECTA|BD');
  const bt = read('BILIRRUBINA TOTAL|BT');
  const got = read('ASPARTATO AMINOTRANSFERASA|ASAT-GOT|GOT|AST');
  const gpt = read('ALANINA AMINOTRANSFERASA|ALAT-GPT|GPT|ALT');
  const fa = read('FOSFATASA ALCALINA SERICA|FAL|FA');
  const ggt = read('GAMMA GLUTAMIL TRANSFERASA|GGT');
  const proteins = read('PROTE[IÍ]NAS TOTALES');
  const albumin = read('ALB[UÚ]MINA');
  const hepRows = [bd, bt, got, gpt, fa];
  if (hepRows.every((row) => row !== null)) {
    const limits = [0.3, 1.2, 32, 33, 104];
    const abnormal = hepRows.some((row, index) => {
      const numeric = row ? normalizeDecimalForMath(row.value) : null;
      return Boolean(row?.abnormal) || (numeric !== null && numeric > limits[index]);
    });
    const components = hepRows.map((row) => row?.value ?? '');
    const value = abnormal ? components.join('/') : 'sp';
    output.push({ ...item('hep', value, abnormal), components });
  }
  add('ggt', ggt);

  const kptt = read('TIEMPO DE TROMBOPLASTINA PARCIAL|KPTT');
  const tp = read('TIEMPO DE PROTROMBINA');
  const rin = read('R\\.I\\.N\\.|RIN');
  const fibrinogen = read('FIBRIN[OÓ]GENO');
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

  add('pcr', read('PROTE[IÍ]NA C REACTIVA|PCR'));
  add('ldh', read('LACTATO DESHIDROGENASA|LDH'));
  add('alb', albumin);
  add('prot', proteins);
  add('tacrol', read('TACROL(?:EMIA)?'));

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
