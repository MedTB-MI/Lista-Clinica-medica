import { describe, expect, it } from 'vitest';
import { parseRawLabReport } from '../src/engine/parser';
import { reconcile } from '../src/engine/reconcile';
import type { LabKey } from '../src/engine/types';

const parsedValues = (input: string): Map<LabKey, string> =>
  new Map(parseRawLabReport(input).map((item) => [item.key, item.value]));

const run = (yesterday = '', todayLab = '', todayStudies = ''): string =>
  reconcile({ yesterday, todayLab, todayStudies }).output;

describe('parser seccional de laboratorio hospitalario', () => {
  it('A — extrae plaquetas sin metadata intermedia', () => {
    expect(parsedValues('PLAQUETAS RECUENTO\n27').get('plaq')).toBe('27m');
  });

  it('B — ignora Método entre plaquetas y resultado', () => {
    expect(
      parsedValues(
        'PLAQUETAS RECUENTO\nMétodo: Analizador hematológico automatizado.\n27',
      ).get('plaq'),
    ).toBe('27m');
  });

  it('reconoce las variantes largas de plaquetas dentro del mismo modelo seccional', () => {
    for (const label of ['PLAQUETAS', 'RECUENTO DE PLAQUETAS']) {
      expect(parsedValues(`${label}\nMétodo: automatizado\n27`).get('plaq')).toBe('27m');
    }
  });

  it('C — no captura fecha de método ni rango de referencia como urea', () => {
    expect(
      parsedValues(
        'UREA EN SANGRE\nMétodo: cinético 20.02.2025\n24\nmg/dl\n17-49',
      ).get('u'),
    ).toBe('24');
  });

  it('D — extrae creatinina dentro de su sección', () => {
    expect(
      parsedValues(
        'CREATININA EN SANGRE\nMétodo: cinético\n0.76\nmg/dl\n0.5-0.9',
      ).get('cr'),
    ).toBe('0.76');
  });

  it('E — extrae calcio iónico dentro de su sección', () => {
    expect(
      parsedValues(
        'CALCIO IONICO\nMétodo: electrodo selectivo\n1.03\nmmol/l\n1.09-1.3',
      ).get('cai'),
    ).toBe('1.03');
  });

  it('F — extrae fósforo dentro de su sección', () => {
    expect(
      parsedValues(
        'FOSFORO EN SANGRE\nMétodo: colorimétrico\n3.9\nmg/dl\n2.5-4.5',
      ).get('p'),
    ).toBe('3.9');
  });

  it('G — extrae magnesio dentro de su sección', () => {
    expect(
      parsedValues(
        'MAGNESIO EN SANGRE\nMétodo: colorimétrico\n2.2\nmg/dl\n1.6-2.6',
      ).get('mg'),
    ).toBe('2.2');
  });

  it('H — mantiene proteínas y albúmina como conceptos independientes', () => {
    const values = parsedValues(`
PROTEÍNAS TOTALES
Método: colorimétrico
5.83

ALBÚMINA
Método: colorimétrico
3.16
`);
    expect(values.get('prot')).toBe('5.83');
    expect(values.get('alb')).toBe('3.16');
  });

  it('I — extrae los cinco componentes del hepatograma con Método', () => {
    const parsed = parseRawLabReport(`
HEPATOGRAMA

BILIRRUBINA DIRECTA
Método: colorimétrico
0.39

BILIRRUBINA TOTAL
Método: colorimétrico
0.53

ASPARTATO AMINOTRANSFERASA
Método: cinético
44

ALANINA AMINOTRANSFERASA
Método: cinético
44

FOSFATASA ALCALINA SERICA
Método: cinético
122

PROTEINAS TOTALES
Método: colorimétrico
5.83

ALBUMINA
Método: colorimétrico
3.16
`);
    const hepatogram = parsed.find((item) => item.key === 'hep');
    expect(hepatogram?.components).toEqual(['0.39', '0.53', '44', '44', '122']);
    expect(hepatogram?.value).toBe('0.39/0.53/44/44/122');
  });

  it('no cruza al resultado del analito siguiente si una sección no tiene resultado', () => {
    const values = parsedValues(`
UREA EN SANGRE
Método: cinético
Resultado no disponible
CREATININA EN SANGRE
0.76
`);
    expect(values.has('u')).toBe(false);
    expect(values.get('cr')).toBe('0.76');
  });

  it('no usa un rango aislado como resultado', () => {
    expect(
      parsedValues(
        'UREA EN SANGRE\nMétodo: cinético\n20-02-2025\nmg/dl\n17-49',
      ).has('u'),
    ).toBe(false);
  });

  it('acepta una flecha antes del resultado sin confundirla con el valor', () => {
    expect(
      parsedValues(
        'CREATININA EN SANGRE\nMétodo: cinético\n↑\n0,76\nmg/dl\n0,5-0,9',
      ).get('cr'),
    ).toBe('0,76');
  });

  it('tolera CRLF, tabs, coma decimal, flechas y resultado crítico', () => {
    const values = parsedValues(
      'PLAQUETAS RECUENTO\r\nMétodo:\tautomatizado\r\n27,5\r\n↓\r\nResultado confirmado\r\n*** RESULTADO CRITICO ***\r\nmil/mm3\r\n150-410',
    );
    expect(values.get('plaq')).toBe('27,5m');
  });
});

describe('reconciliación con export hospitalario sintético', () => {
  const yesterday =
    'Hto 24.4 Hb 8.3 GB 2.13m 79.1%N Plaq 46m U 97 Cr 1.02 Iono 134/4.1/102 Hep 0.3/0.43/41/42/188 PrT 4.6 Alb 3.05 CaI 1.18 P 2.3 Mg 1.7';

  const todayLab = `
HEMOGRAMA
HEMATOCRITO
20.5
HEMOGLOBINA
7
RECUENTO DE GLOBULOS BLANCOS
3.91
BLASTOS
48
PLAQUETAS RECUENTO
Método: Analizador hematológico automatizado.
27
↓
mil/mm3
150-410

UREA EN SANGRE
Método: método sintético 20.02.2025
24
mg/dl
17-49
CREATININA EN SANGRE
Método: método sintético
0.76
mg/dl
0.5-0.9
CALCIO IONICO
Método: método sintético
1.03
mmol/l
FOSFORO EN SANGRE
Método: método sintético
3.9
mg/dl
MAGNESIO EN SANGRE
Método: método sintético
2.2
mg/dl

HEPATOGRAMA
BILIRRUBINA DIRECTA
Método: método sintético
0.39
BILIRRUBINA TOTAL
Método: método sintético
0.53
ASPARTATO AMINOTRANSFERASA
Método: método sintético
44
ALANINA AMINOTRANSFERASA
Método: método sintético
44
FOSFATASA ALCALINA SERICA
Método: método sintético
122
PROTEINAS TOTALES
Método: método sintético
5.83
ALBUMINA
Método: método sintético
3.16
`;

  it('reemplaza todos los valores actuales sin conservarlos como viejos', () => {
    expect(run(yesterday, todayLab)).toBe(
      'Hto 20.5 Hb 7 GB 3.9m 48%B (2.1m 79.1%N) Plaq 27m (46m) U 24 (97) Cr 0.76 (1.02) Iono 134/4.1/102 Hep 0.39/0.53/44/44/122 PrT 5.8 Alb 3.16 CaI 1.03 P 3.9 Mg 2.2',
    );
  });
});

describe('parser de estudios multilínea', () => {
  const multilineTep = `
TOMOGRAFIA DE TORAX CON CONTRASTE - PROTOCOLO TEP

Historia clínica: control sintético.

Técnica: adquisición helicoidal con contraste endovenoso.

No se observan defectos de relleno. Sin signos tomográficos de tromboembolismo pulmonar.

Compromiso intersticial y bronquial a predominio de ambos lóbulos inferiores.

IMPRESIÓN DIAGNOSTICA:
Los hallazgos impresionan de probable etiología infecciosa/inflamatoria.
Pequeño quiste simple incidental sin relevancia para este patrón.
`;

  it('mantiene un único informe unido pese a los párrafos vacíos', () => {
    expect(run('TC Tx c/: sin TEP', '', multilineTep)).toBe(
      'TC tx: sin signos TEP, comp interst y bronq a pred de ambos LI, impresionan infeccioso vs infl.',
    );
  });

  it('sigue separando dos estudios por sus encabezados reales', () => {
    expect(run('', '', `${multilineTep}\nRMN SNC: sin hallazgos relevantes.`)).toBe(
      'TC tx: sin signos TEP, comp interst y bronq a pred de ambos LI, impresionan infeccioso vs infl. RMN SNC: sin hallazgos relevantes.',
    );
  });
});
