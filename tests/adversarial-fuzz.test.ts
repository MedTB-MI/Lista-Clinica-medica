import { describe, expect, it } from 'vitest';
import { parseRawLabReport } from '../src/engine/parser';
import { reconcile } from '../src/engine/reconcile';

type LabSpec = {
  label: string;
  key: string;
  value: string;
  expected: string;
  accents?: string;
};

const directSpecs: LabSpec[] = [
  { label: 'HEMATOCRITO', key: 'hto', value: '20.5', expected: '20.5' },
  { label: 'HEMOGLOBINA', key: 'hb', value: '7', expected: '7' },
  { label: 'RECUENTO DE GLOBULOS BLANCOS', key: 'gb', value: '3.91', expected: '3.91m' },
  { label: 'PLAQUETAS RECUENTO', key: 'plaq', value: '27', expected: '27m' },
  { label: 'UREA EN SANGRE', key: 'u', value: '24', expected: '24' },
  { label: 'CREATININA EN SANGRE', key: 'cr', value: '0.76', expected: '0.76' },
  { label: 'CALCIO IONICO', key: 'cai', value: '1.03', expected: '1.03', accents: 'CALCIO IÓNICO' },
  { label: 'CALCIO EN SANGRE', key: 'ca', value: '8.3', expected: '8.3' },
  { label: 'FOSFORO EN SANGRE', key: 'p', value: '3.9', expected: '3.9', accents: 'FÓSFORO EN SANGRE' },
  { label: 'MAGNESIO EN SANGRE', key: 'mg', value: '2.2', expected: '2.2' },
  { label: 'ACIDO URICO EN SANGRE', key: 'ac_urico', value: '2.3', expected: '2.3', accents: 'ÁCIDO ÚRICO EN SANGRE' },
  { label: 'GAMMA GLUTAMIL TRANSFERASA', key: 'ggt', value: '92', expected: '92' },
  { label: 'PROTEINAS TOTALES', key: 'prot', value: '5.83', expected: '5.83', accents: 'PROTEÍNAS TOTALES' },
  { label: 'ALBUMINA', key: 'alb', value: '3.16', expected: '3.16', accents: 'ALBÚMINA' },
  { label: 'PROTEINA C REACTIVA', key: 'pcr', value: '42.1', expected: '42.1', accents: 'PROTEÍNA C REACTIVA' },
];

const formats = (() => {
  const lineEndings = ['\n', '\r\n'];
  const whitespace = ['', '  ', '\t', ' \t '];
  const metadata = [
    '',
    'Método: cinético',
    'Método:\tcambio de valor de referencia desde 20.02.2025',
    'Método: Analizador hematológico automatizado.',
  ];
  const flags = ['', '↓', 'Resultado confirmado\n*** RESULTADO CRITICO ***'];
  const units = ['', 'mg/dl', 'mil/mm3'];
  const ranges = ['', '17-49', '150-410'];
  const decimals = [false, true];
  const inline = [false, true];
  const all: Array<{
    eol: string;
    space: string;
    method: string;
    flag: string;
    unit: string;
    range: string;
    comma: boolean;
    inline: boolean;
  }> = [];
  for (const eol of lineEndings) {
    for (const space of whitespace) {
      for (const method of metadata) {
        for (const flag of flags) {
          for (const unit of units) {
            for (const range of ranges) {
              for (const comma of decimals) {
                for (const isInline of inline) {
                  all.push({ eol, space, method, flag, unit, range, comma, inline: isInline });
                }
              }
            }
          }
        }
      }
    }
  }
  // A fixed stride samples all dimensions without making the test needlessly huge.
  return Array.from({ length: 64 }, (_, index) => all[(index * 137) % all.length]);
})();

const withSpacing = (label: string, spacing: string, alternate?: string): string =>
  (alternate ?? label).replace(/\s+/g, `${spacing} `).trim();

const section = (label: string, value: string, format: (typeof formats)[number], alternate?: string): string => {
  const measured = format.comma ? value.replace('.', ',') : value;
  const spacedLabel = withSpacing(label, format.space, alternate);
  const valueLine = format.inline ? `${spacedLabel}:${format.space}${measured}` : `${spacedLabel}${format.eol}${measured}`;
  const metadata = format.method ? `${format.eol}${format.method}` : '';
  const flag = format.flag ? `${format.eol}${format.flag}` : '';
  const unit = format.unit ? `${format.eol}${format.unit}` : '';
  const range = format.range ? (format.unit ? `${format.eol}${format.range}` : `${format.eol}${format.range}`) : '';
  return `${valueLine}${metadata}${flag}${unit}${range}`;
};

const parsed = (input: string, key: string) => parseRawLabReport(input).find((item) => item.key === key);

describe('batería adversarial determinística del parser', () => {
  it('mantiene el resultado correcto en más de 1000 combinaciones', () => {
    let cases = 0;
    for (const spec of directSpecs) {
      for (const format of formats) {
        const input = `HEMOGRAMA\n${section(spec.label, spec.value, format, spec.accents)}`;
        const item = parsed(input, spec.key);
        expect(item?.value, `${spec.label} case ${cases}`).toBe(
          format.comma ? spec.expected.replace('.', ',') : spec.expected,
        );
        cases += 1;
      }
    }
    expect(cases).toBe(960);
  });

  it('mantiene ionograma, hepatograma y blastos bajo las mismas mutaciones', () => {
    let cases = 0;
    for (const format of formats) {
      const iono = [
        section('SODIO', '134', format),
        section('POTASIO', '4.1', format),
        section('CLORO', '102', format),
      ].join(format.eol);
      expect(parsed(`IONOGRAMA${format.eol}${iono}`, 'iono')?.value).toBe(
        format.comma ? '134/4,1/102' : '134/4.1/102',
      );

      const hep = [
        section('BILIRRUBINA DIRECTA', '0.39', format),
        section('BILIRRUBINA TOTAL', '0.53', format),
        section('ASPARTATO AMINOTRANSFERASA', '44', format),
        section('ALANINA AMINOTRANSFERASA', '44', format),
        section('FOSFATASA ALCALINA SERICA', '122', format),
      ].join(format.eol);
      expect(parsed(`HEPATOGRAMA${format.eol}${hep}`, 'hep')?.components).toEqual(
        format.comma ? ['0,39', '0,53', '44', '44', '122'] : ['0.39', '0.53', '44', '44', '122'],
      );

      const blood = `HEMOGRAMA${format.eol}${section('RECUENTO DE GLOBULOS BLANCOS', '3.91', format)}${format.eol}${section('BLASTOS', '48', format)}`;
      expect(parsed(blood, 'gb')?.value).toBe(
        format.comma ? '3,91m B48%' : '3.91m B48%',
      );
      cases += 3;
    }
    expect(cases).toBe(192);
  });

  it('no cruza al analito siguiente en todas las variantes de metadata', () => {
    for (const format of formats) {
      const input = `HEMOGRAMA${format.eol}${section('UREA EN SANGRE', '', format)}${format.eol}Resultado no disponible${format.eol}CREATININA EN SANGRE${format.eol}0.76`;
      expect(parsed(input, 'u')).toBeUndefined();
      expect(parsed(input, 'cr')?.value).toBe('0.76');
    }
  });

  it('reconciliation nunca deja el valor previo como valor actual', () => {
    const updates = [
      { label: 'PLAQUETAS RECUENTO', outputLabel: 'Plaq', old: '46m', value: '27', current: '27m' },
      { label: 'UREA EN SANGRE', outputLabel: 'U', old: '97', value: '24', current: '24' },
      { label: 'CREATININA EN SANGRE', outputLabel: 'Cr', old: '1.02', value: '0.76', current: '0.76' },
      { label: 'CALCIO IONICO', outputLabel: 'CaI', old: '1.18', value: '1.03', current: '1.03' },
      { label: 'FOSFORO EN SANGRE', outputLabel: 'P', old: '2.3', value: '3.9', current: '3.9' },
      { label: 'MAGNESIO EN SANGRE', outputLabel: 'Mg', old: '1.7', value: '2.2', current: '2.2' },
      { label: 'PROTEINAS TOTALES', outputLabel: 'PrT', old: '4.6', value: '5.83', current: '5.8' },
      { label: 'ALBUMINA', outputLabel: 'Alb', old: '3.05', value: '3.16', current: '3.16' },
    ];
    let cases = 0;
    for (const update of updates) {
      for (const format of formats) {
        const output = reconcile({
          yesterday: `${update.outputLabel} ${update.old}`,
          todayLab: `HEMOGRAMA${format.eol}${section(update.label, update.value, format)}`,
          todayStudies: '',
        }).output;
        const currentPattern = new RegExp(`${update.outputLabel} ${update.current.replace('.', '[.,]')}(?:\\s|$)`);
        const oldPattern = new RegExp(`${update.outputLabel} ${update.old.replace('.', '[.,]')}(?:\\s|$)`);
        expect(output, `${update.outputLabel} case ${cases}`).toMatch(currentPattern);
        expect(output, `${update.outputLabel} case ${cases}`).not.toMatch(oldPattern);
        cases += 1;
      }
    }
    expect(cases).toBe(512);
  });
});

describe('propiedades adversariales de reconciliation e imágenes', () => {
  const tep = 'TOMOGRAFIA DE TORAX CON CONTRASTE - PROTOCOLO TEP';
  const body = [
    'INFORME',
    'TÉCNICA: adquisición helicoidal con contraste.',
    'HISTORIA CLÍNICA: control sintético.',
    'COMPARACIÓN: sin estudio previo.',
    'Sin signos tomográficos de tromboembolismo pulmonar.',
    'Compromiso intersticial y bronquial a predominio de ambos lóbulos inferiores.',
    'IMPRESIÓN DIAGNÓSTICA:',
    'Los hallazgos impresionan de etiología infecciosa/inflamatoria.',
    'Quiste simple incidental.',
  ];
  const expected = 'TC tx: sin signos TEP, comp interst y bronq a pred de ambos LI, impresionan infeccioso vs infl.';

  it('las líneas vacías, espacios, tabs y CRLF no cambian un estudio único', () => {
    const separators = ['', '\n', '\n\n', '\n \t\n\n\n', '\r\n\r\n'];
    for (const separator of separators) {
      const input = [tep, ...body].join(separator);
      expect(reconcile({ yesterday: '', todayLab: '', todayStudies: input }).output).toBe(expected);
    }
  });

  it('dos encabezados reales siguen siendo dos estudios', () => {
    const second = 'TC SNC: sin hallazgos relevantes.';
    const output = reconcile({ yesterday: '', todayLab: '', todayStudies: `${tep}\n\n${body.join('\n')}\n\n${second}` }).output;
    expect(output).toBe(`${expected} TC SNC: sin hallazgos relevantes.`);
  });
});
