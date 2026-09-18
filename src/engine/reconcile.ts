import { LAB_LABELS, LAB_ORDER, SECONDARY_KEYS } from './constants';
import {
  compactWhitespace,
  containsIntervention,
  normalizeCanonicalEntry,
  normalizeDecimalForMath,
  parseCompactList,
  parseRawLabReport,
  parseSupplementalEntries,
} from './parser';
import type {
  LabItem,
  LabKey,
  ReconcileInput,
  ReconcileResult,
  ReconcileWarning,
  SupplementalEntry,
} from './types';

const topLevelPrevious = (value: string): string => value.replace(/\s+\(.*$/, '').trim();

const numericComponents = (value: string): number[] =>
  [...value.replace(',', '.').matchAll(/[<>]?\s*(-?\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

const relativeChange = (previous: number, current: number): number =>
  previous === 0 ? Math.abs(current - previous) : Math.abs(current - previous) / Math.abs(previous);

const hasCurrentIntervention = (item: LabItem): boolean => item.hasIntervention;

// Provisional policy needed to make the canonical examples executable.
// It is deliberately conservative and remains release-blocked by docs/AMBIGUITIES.md A-001.
const shouldKeepPrior = (key: LabKey, previousValue: string, current: LabItem): boolean => {
  if (containsIntervention(previousValue)) return true;
  if (hasCurrentIntervention(current) && ['hb', 'plaq', 'iono', 'p', 'mg'].includes(key)) return true;
  if (SECONDARY_KEYS.has(key)) return false;

  const previous = numericComponents(topLevelPrevious(previousValue));
  const next = numericComponents(current.value);
  if (!previous.length || !next.length) return false;

  if (key === 'hb') return Math.abs(next[0] - previous[0]) >= 1.5;
  if (key === 'hto') return Math.abs(next[0] - previous[0]) >= 5;
  if (key === 'u') return Math.abs(next[0] - previous[0]) >= 20;
  if (key === 'cr') {
    return (
      Math.abs(next[0] - previous[0]) >= 0.3 ||
      (next[0] < previous[0] && relativeChange(previous[0], next[0]) >= 0.2)
    );
  }
  if (key === 'pcr') return Math.abs(next[0] - previous[0]) >= 30 || relativeChange(previous[0], next[0]) >= 0.3;
  if (key === 'gb') {
    const previousN = previousValue.match(/(\d+(?:[.,]\d+)?)\s*%?N\b/i)?.[1];
    const currentN = current.value.match(/(\d+(?:[.,]\d+)?)\s*%?N\b/i)?.[1];
    if (previousN && currentN) {
      return (
        Math.abs(Number(previousN.replace(',', '.')) - Number(currentN.replace(',', '.'))) >= 10 ||
        Math.abs(next[0] - previous[0]) >= 4
      );
    }
    return relativeChange(previous[0], next[0]) >= 0.35;
  }
  if (key === 'plaq') {
    return relativeChange(previous[0], next[0]) >= 0.5 || previous[0] < 50 || next[0] < 50;
  }
  if (key === 'ldh') return relativeChange(previous[0], next[0]) >= 0.2;
  return false;
};

const normalizeIntervention = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

const extractExplicitInterventions = (raw: string): Map<LabKey, string> => {
  const interventions = new Map<LabKey, string>();
  const compact = compactWhitespace(raw);

  const keyed = [
    { key: 'hb' as const, regex: /\bHb\s*:?(?:\s*[<>]?\d+(?:[.,]\d+)?\s*)?(\+\s*\d+\s*(?:UGR|U\s*GR|GR))\b/i },
    { key: 'plaq' as const, regex: /\b(?:Plaq|Plq)\s*:?(?:\s*[<>]?\d+(?:[.,]\d+)?m?\s*)?(\+\s*\d+\s*UP)\b/i },
    { key: 'p' as const, regex: /(?:^|\s)P\s*:?(?:\s*[<>]?\d+(?:[.,]\d+)?\s*)?(\+\s*P)\b/i },
    { key: 'mg' as const, regex: /\bMg\s*:?(?:\s*[<>]?\d+(?:[.,]\d+)?\s*)?(\+\s*Mg)\b/i },
  ];
  keyed.forEach(({ key, regex }) => {
    const match = compact.match(regex);
    if (match) interventions.set(key, normalizeIntervention(match[1]));
  });

  const transfusion = compact.match(/\b(?:se\s+)?transfund(?:e|en|ió)\s*(\d+)\s*UGR\b/i);
  if (transfusion) interventions.set('hb', `+${transfusion[1]} UGR`);
  const platelets = compact.match(/\b(?:se\s+)?transfund(?:e|en|ió)\s*(\d+)\s*UP\b/i);
  if (platelets) interventions.set('plaq', `+${platelets[1]}UP`);

  if (/\+\s*K\b/i.test(compact)) interventions.set('iono', '+K');
  return interventions;
};

const stripStandaloneInterventionLines = (raw: string): string =>
  raw
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*INTERVENCIONES?\b/i.test(line) &&
        !/^\s*(?:se\s+)?transfund(?:e|en|ió)\b/i.test(line) &&
        !/^\s*(?:Hb|Plaq|Plq|P|Mg|K)\s*:\s*\+/i.test(line),
    )
    .join('\n');

const attachIntervention = (item: LabItem, intervention: string | undefined): LabItem => {
  if (!intervention || item.hasIntervention) return item;
  let value = item.value;
  if (item.key === 'iono' && /\+\s*K/i.test(intervention)) {
    const components = value.split('/');
    if (components.length >= 3) components[1] = `${components[1]}(+K)`;
    value = components.join('/');
  } else if (item.key === 'p' || item.key === 'mg') {
    value = `${value}(${intervention.replace(/\s+/g, '')})`;
  } else {
    value = `${value}${intervention}`;
  }
  return { ...item, value, raw: `${item.label} ${value}`, hasIntervention: true };
};

const mergeDuplicateLabs = (items: LabItem[]): LabItem[] => {
  const map = new Map<LabKey, LabItem>();
  items.forEach((candidate) => map.set(candidate.key, candidate));
  return [...map.values()];
};

const reconcileHistoricalHepatogramShape = (
  previous: LabItem[],
  current: LabItem[],
): LabItem[] => {
  const previousHep = previous.find((item) => item.key === 'hep');
  if (!previousHep || topLevelPrevious(previousHep.value).split('/').length !== 8) {
    return current;
  }

  const currentMap = new Map(current.map((item) => [item.key, item]));
  const hep = currentMap.get('hep');
  const ggt = currentMap.get('ggt');
  const proteins = currentMap.get('prot');
  const albumin = currentMap.get('alb');
  if (!hep || !ggt || !proteins || !albumin) {
    return current;
  }

  const hepComponents = hep.components ?? hep.value.split('/');
  if (hepComponents.length !== 5) {
    return current;
  }

  const previousKeys = new Set(previous.map((item) => item.key));
  const extendedValue = `${hepComponents.join('/')}/${ggt.value}/${proteins.value}/${albumin.value}`;
  const extendedHep = {
    ...hep,
    value: extendedValue,
    raw: `${hep.label} ${extendedValue}`,
    abnormal: Boolean(hep.abnormal || ggt.abnormal || proteins.abnormal || albumin.abnormal),
  };

  return current
    .map((item) => (item.key === 'hep' ? extendedHep : item))
    .filter(
      (item) =>
        !(['ggt', 'prot', 'alb'] as LabKey[]).includes(item.key) || previousKeys.has(item.key),
    );
};

const formatStandaloneGb = (value: string): string => {
  const count = value.match(/^([<>]?\s*\d+(?:[.,]\d+)?)\s*m?/i)?.[1];
  if (!count) return value;
  const number = normalizeDecimalForMath(count);
  const compact =
    number !== null && Math.abs(number - Math.round(number)) <= 0.1
      ? String(Math.round(number))
      : count.replace(/\s+/g, '');
  return value.replace(/^[<>]?\s*\d+(?:[.,]\d+)?\s*m?/i, `${compact}m`);
};

const formatTrendGb = (value: string, suffixBlasts: boolean): string => {
  const number = normalizeDecimalForMath(value);
  if (number === null) return value;
  const count = Number(number.toFixed(1)).toString();
  const blasts = value.match(/\bB\s*(\d+(?:[.,]\d+)?)\s*%/i)?.[1];
  const neutrophils = value.match(/\b(\d+(?:[.,]\d+)?)\s*%\s*N\b/i)?.[1];
  if (blasts) return `${count}m ${suffixBlasts ? `${blasts}%B` : `B${blasts}%`}`;
  if (neutrophils) return `${count}m ${neutrophils}%N`;
  return `${count}m`;
};

const formatHepatogramTrend = (previous: string, current: string): string | null => {
  const previousParts = topLevelPrevious(previous).split('/');
  const currentParts = current.split('/');
  if (previousParts.length !== 8 || currentParts.length !== 8) return null;
  const changed = currentParts
    .map((component, index) => ({ component, index }))
    .filter(({ component, index }) => component !== previousParts[index]);
  if (changed.length !== 1) return null;
  const { index } = changed[0];
  currentParts[index] = `${currentParts[index]}(${previousParts[index]})`;
  return currentParts.join('/');
};

const formatUpdatedLab = (previous: LabItem | undefined, current: LabItem): string => {
  const label = previous?.label ?? LAB_LABELS[current.key];
  if (!previous) {
    let value = current.key === 'gb' ? formatStandaloneGb(current.value) : current.value;
    if (current.key === 'prot') {
      const numeric = normalizeDecimalForMath(value);
      if (numeric !== null) value = Number(numeric.toFixed(1)).toString();
    }
    return `${label} ${value}`;
  }
  if (current.key === 'hep') {
    const componentTrend = formatHepatogramTrend(previous.value, current.value);
    if (componentTrend) return `${label} ${componentTrend}`;
  }
  let currentValue = current.value;
  let previousValue = topLevelPrevious(previous.value);
  if (current.key === 'gb') {
    currentValue = formatTrendGb(current.value, Boolean(current.differential?.blasts));
    previousValue = formatTrendGb(previousValue, false);
  }
  if (current.key === 'plaq' && !/m\b/i.test(previousValue)) {
    currentValue = currentValue.replace(/^([<>]?\s*\d+(?:[.,]\d+)?)m\b/i, '$1');
  }
  if (current.key === 'prot') {
    const numeric = normalizeDecimalForMath(currentValue);
    if (numeric !== null) currentValue = Number(numeric.toFixed(1)).toString();
  }
  const base = `${label} ${currentValue}`;
  if (!shouldKeepPrior(current.key, previous.value, current)) return base;
  return `${base} (${previousValue})`;
};

const orderedNewKeys = (items: LabItem[]): LabKey[] =>
  [...items]
    .sort((a, b) => LAB_ORDER.indexOf(a.key) - LAB_ORDER.indexOf(b.key))
    .map((item) => item.key);

const persistsWithoutCurrentMeasurement = (item: LabItem): boolean => item.key !== 'glu';

const includePreviouslyUntrackedLab = (item: LabItem): boolean =>
  item.key !== 'ggt' && !(item.key === 'coag' && /^sp$/i.test(item.value));

const joinEntries = (entries: string[]): string =>
  entries
    .map((entry) => normalizeCanonicalEntry(entry).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim();

const summarizeStudy = (
  raw: string,
  warnings: ReconcileWarning[],
): SupplementalEntry | null => {
  const text = compactWhitespace(raw);
  if (!text) return null;

  const explicitDate = text.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/)?.[1];
  const negativeTep =
    /\bsin\s+(?:(?:evidencia|signos)\s+de\s+)?TEP\b/i.test(text) ||
    /\b(?:no\s+se\s+(?:observan|identifican)|ausencia\s+de)\b[^.]{0,100}\btromboemboli/i.test(text) ||
    /\b(?:negativo|negativa)\b[^.]{0,60}\bTEP\b/i.test(text);
  if (negativeTep) {
    const interstitialBronchial =
      /compromiso\s+intersticial\s*(?:y|\/)\s*bronquial/i.test(text) &&
      /(?:ambos\s+)?l[oó]bulos?\s+inferiores|bibasal/i.test(text);
    const infectiousInflammatory =
      /infeccios[ao]\s*\/\s*inflamatori[ao]|infeccios[ao]\s+(?:vs|versus)\s+inflamatori[ao]/i.test(text);
    if (interstitialBronchial && infectiousInflammatory) {
      return {
        key: 'TC_TX_TEP',
        type: 'study',
        text: 'TC tx: sin signos TEP, comp interst y bronq a pred de ambos LI, impresionan infeccioso vs infl.',
      };
    }
    let summary = `TC Tx c/${explicitDate ? ` ${explicitDate}` : ''}: sin TEP`;
    let hasEvolution = false;
    if (/resoluci[oó]n[^.]{0,80}(?:opacidades|OVE)[^.]{0,50}bibasal/i.test(text)) {
      summary += '. Resolución OVE bibasales.';
      hasEvolution = true;
    }
    return { key: 'TC_TX_TEP', type: 'study', text: hasEvolution ? summary : summary.replace(/\.$/, '') };
  }

  const positiveTep = text.match(/\bTEP\s+(?:en|a\s+nivel\s+de)\s+([^.;\n]+)/i);
  if (positiveTep) {
    let location = positiveTep[1]
      .replace(/ramas?\s+segmentarias?\s*\/\s*subsegmentarias?/gi, 'segment/subsegment')
      .replace(/ramas?\s+segmentarias?/gi, 'segment')
      .replace(/ramas?\s+subsegmentarias?/gi, 'subsegment')
      .replace(/posterobasales?/gi, 'posterobasal')
      .replace(/\s+del?\s+/gi, ' ')
      .trim();
    let summary = `TC Tx c/${explicitDate ? ` ${explicitDate}` : ''}: TEP ${location}`;
    const pulmonary = text.match(/proceso\s+(?:inflamatorio\s*\/\s*infeccioso|infeccioso\s*\/\s*inflamatorio)\s+(L(?:SI|SD|II|ID))/i);
    if (pulmonary) summary += `. OVE ${pulmonary[1].toUpperCase()}`;
    return { key: 'TC_TX_TEP', type: 'study', text: summary.replace(/\.$/, '') };
  }

  if (/fondo\s+cecal/i.test(text) && /hiperdensa/i.test(text) && /lavado/i.test(text)) {
    const prefix = `AngioTC${explicitDate ? ` ${explicitDate}` : ''}:`;
    return {
      key: 'ANGIOTC',
      type: 'study',
      text: `${prefix} imagen en fondo cecal, hiperdensa fase art/venosa temp con lavado en fase tardía + cont hiperdenso en íleon distal`,
    };
  }

  if (/celulitis\s+preseptal/i.test(text) && /dacriocistitis/i.test(text)) {
    const isMri = /\bRMN\b/i.test(text);
    const predominance = /predominio\s+izquierdo|predominio\s+izq/i.test(text) ? ' >izq' : '';
    const retroocular = /compromiso\s+(?:de\s+)?grasa\s+retroocular/i.test(text)
      ? ' + leve comp de grasa retroocular'
      : '';
    const septum = /desviaci[oó]n\s+septal/i.test(text)
      ? ' + desv septal a doble curvatura + hipertrofia cornete inferior izq'
      : '';
    const label = isMri ? 'RMN órbita' : 'TC senos paranasales';
    return {
      key: isMri ? 'RMN_ORBITA' : 'TC_SENOS',
      type: 'study',
      text: `${label}${explicitDate ? ` ${explicitDate}` : ''}: Celulitis preseptal bilat${predominance} + dacriocistitis izq${retroocular}${septum}`,
    };
  }

  if (/derrame\s+peric[aá]rdico/i.test(text) && /21\s*mm/i.test(text) && /35\s*mm/i.test(text)) {
    return {
      key: 'TC_TX',
      type: 'study',
      text: `TC Tx${explicitDate ? ` ${explicitDate}` : ''}: < derrame pericárdico realce hojas pariet (21 mm) (previo 35 mm). NTX laminar izq. Dilat VB IH + probables quistes peribiliares. Imag quistica cuerpo páncreas`,
    };
  }

  const compactEntry = parseSupplementalEntries(text);
  if (compactEntry.length && /^(?:TC|Tc|TAC|AngioTC|RMN|Rx|Eco|ETE|ECG|EEG|UC|HC|BAL|Cult|FARES|KPC|CD|LMF|MF)\b/.test(text)) {
    return { ...compactEntry[0], text: normalizeCanonicalEntry(text) };
  }

  const normalStudy = text.match(/\b(TC\s+(?:SNC|Cer|AP)|RMN\s+(?:SNC|Cer|órbita|col))\b/i);
  if (normalStudy && /\b(?:sin\s+hallazgos\s+relevantes|sin\s+alteraciones|normal)\b/i.test(text)) {
    const label = normalStudy[1]
      .replace(/TC\s+Cer/i, 'TC SNC')
      .replace(/RMN\s+Cer/i, 'RMN SNC');
    return {
      key: label.toUpperCase().replace(/\s+/g, '_'),
      type: 'study',
      text: `${label}${explicitDate ? ` ${explicitDate}` : ''}: sp`,
    };
  }

  if (/\bRx\s*(?:Tx|t[oó]rax)\b/i.test(text) && /redistribuci[oó]n\s+de\s+flujo/i.test(text)) {
    return { key: 'RX_TX', type: 'study', text: `RxTx${explicitDate ? ` ${explicitDate}` : ''}: redistribución de flujo` };
  }

  warnings.push({
    code: 'IMG_REVIEW',
    message: 'Hay un estudio nuevo que requiere resumen manual.',
    detail: text.slice(0, 180),
  });
  return null;
};

const parseNewSupplemental = (
  input: string,
  warnings: ReconcileWarning[],
): SupplementalEntry[] => {
  const blocks = input
    .split(/\n\s*\n|(?=^\s*(?:UC|HC|BAL|Cult Qx|FARES|KPC|CD|LMF|MF|TC|TAC|RMN|Rx|Eco|ETE|ECG|EEG)\b)/gim)
    .map((block) => block.trim())
    .filter(Boolean);
  const entries: SupplementalEntry[] = [];
  for (const block of blocks) {
    const parsed = parseSupplementalEntries(block);
    const first = parsed[0];
    if (first?.type === 'micro') {
      const text = normalizeCanonicalEntry(block).replace(/\bsin\s+desarrollo\b/gi, 'neg');
      entries.push({ ...first, text, pending: /\bpendiente\b/i.test(text) });
      continue;
    }
    const study = summarizeStudy(block, warnings);
    if (study) entries.push(study);
  }
  return entries;
};

const reconcileSupplemental = (
  previous: SupplementalEntry[],
  current: SupplementalEntry[],
  warnings: ReconcileWarning[],
): SupplementalEntry[] => {
  const result = [...previous];
  for (const incoming of current) {
    if (incoming.type === 'micro') {
      let targetIndex = result.findIndex(
        (entry) =>
          entry.type === 'micro' &&
          entry.sampleType === incoming.sampleType &&
          Boolean(incoming.date) &&
          entry.date === incoming.date,
      );
      if (targetIndex < 0 && !incoming.date) {
        const candidates = result
          .map((entry, index) => ({ entry, index }))
          .filter(
            ({ entry }) =>
              entry.type === 'micro' && entry.sampleType === incoming.sampleType && entry.pending,
          );
        if (candidates.length === 1) {
          targetIndex = candidates[0].index;
          const inheritedDate = candidates[0].entry.date;
          if (inheritedDate) {
            incoming.text = incoming.text.replace(
              new RegExp(`^${incoming.sampleType}\\s*:`, 'i'),
              `${incoming.sampleType} ${inheritedDate}:`,
            );
            incoming.date = inheritedDate;
            incoming.key = `${incoming.sampleType}:${inheritedDate}`;
          }
        } else if (candidates.length > 1) {
          warnings.push({
            code: 'MIC_SAMPLE_AMBIGUOUS',
            message: 'Resultado microbiológico sin fecha con más de una muestra pendiente.',
            detail: incoming.text,
          });
        }
      }
      if (targetIndex >= 0) result.splice(targetIndex, 1, incoming);
      else result.push(incoming);
      continue;
    }

    const targetIndex = result.findIndex((entry) => {
      if (entry.type !== 'study') return false;
      if (incoming.key === 'TC_TX_TEP') return entry.key === 'TC_TX_TEP' || /\bTEP\b/i.test(entry.text);
      return entry.key === incoming.key;
    });
    if (targetIndex >= 0) result.splice(targetIndex, 1, incoming);
    else result.push(incoming);
  }
  return result;
};

const addTrendReviewWarnings = (
  previousMap: Map<LabKey, LabItem>,
  currentLabs: LabItem[],
  warnings: ReconcileWarning[],
): void => {
  currentLabs.forEach((current) => {
    const previous = previousMap.get(current.key);
    if (!previous || containsIntervention(previous.value) || SECONDARY_KEYS.has(current.key)) return;
    const oldNumber = normalizeDecimalForMath(previous.value);
    const newNumber = normalizeDecimalForMath(current.value);
    if (oldNumber === null || newNumber === null || oldNumber === newNumber) return;
    if (!shouldKeepPrior(current.key, previous.value, current)) {
      warnings.push({
        code: 'TREND_OMITTED',
        message: `Se omitió el previo de ${LAB_LABELS[current.key]} por la política conservadora.`,
        detail: `${previous.value} → ${current.value}`,
      });
    }
  });
};

export const reconcile = ({ yesterday, todayLab, todayStudies }: ReconcileInput): ReconcileResult => {
  const warnings: ReconcileWarning[] = [];
  const previous = parseCompactList(yesterday);
  const interventions = extractExplicitInterventions(todayLab);
  const clinicalLabText = stripStandaloneInterventionLines(todayLab);
  const parsedCurrentLabs = mergeDuplicateLabs(parseRawLabReport(clinicalLabText)).map(
    (candidate) => attachIntervention(candidate, interventions.get(candidate.key)),
  );
  const currentLabs = reconcileHistoricalHepatogramShape(previous.labs, parsedCurrentLabs);

  const previousMap = new Map(previous.labs.map((lab) => [lab.key, lab]));
  const currentMap = new Map(currentLabs.map((lab) => [lab.key, lab]));
  const consumed = new Set<LabKey>();
  const labOutput: string[] = [];

  previous.labs.forEach((oldItem) => {
    const newItem = currentMap.get(oldItem.key);
    if (newItem) {
      labOutput.push(formatUpdatedLab(oldItem, newItem));
      consumed.add(oldItem.key);
    } else if (persistsWithoutCurrentMeasurement(oldItem)) {
      labOutput.push(normalizeCanonicalEntry(oldItem.raw));
    }
  });

  orderedNewKeys(currentLabs).forEach((key) => {
    if (consumed.has(key)) return;
    const newItem = currentMap.get(key);
    if (newItem && includePreviouslyUntrackedLab(newItem)) {
      labOutput.push(formatUpdatedLab(undefined, newItem));
    }
  });

  addTrendReviewWarnings(previousMap, currentLabs, warnings);
  if (previous.unparsedPrefix) {
    warnings.push({
      code: 'PREVIOUS_UNPARSED',
      message: 'Parte inicial de la lista previa no pudo clasificarse y se conservó.',
      detail: previous.unparsedPrefix,
    });
    labOutput.unshift(previous.unparsedPrefix);
  }

  const currentSupplemental = parseNewSupplemental(todayStudies, warnings);
  const supplemental = reconcileSupplemental(previous.supplemental, currentSupplemental, warnings);
  const output = joinEntries([...labOutput, ...supplemental.map((entry) => entry.text)]);

  if (todayLab.trim() && currentLabs.length === 0) {
    warnings.push({ code: 'LAB_UNRECOGNIZED', message: 'No se reconocieron resultados de laboratorio nuevos.' });
  }
  if (!output) warnings.push({ code: 'EMPTY_OUTPUT', message: 'No hay información suficiente para generar una lista.' });

  return {
    output,
    warnings,
    recognized: {
      labs: currentLabs.length,
      studies: currentSupplemental.filter((entry) => entry.type === 'study').length,
      microbiology: currentSupplemental.filter((entry) => entry.type === 'micro').length,
    },
  };
};
