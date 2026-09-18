import { describe, expect, it } from 'vitest';
import { reconcile } from '../src/engine/reconcile';

const run = (yesterday = '', todayLab = '', todayStudies = ''): string =>
  reconcile({ yesterday, todayLab, todayStudies }).output;

describe('tendencias canónicas', () => {
  it('conserva una caída marcada de Hb', () => {
    expect(run('Hb 12', 'Hb 8')).toBe('Hb 8 (12)');
  });

  it('omite una variación trivial de Hb', () => {
    expect(run('Hb 9.1', 'Hb 9.3')).toBe('Hb 9.3');
  });

  it('conserva la respuesta renal relevante', () => {
    expect(run('U 74 Cr 1.8', 'U 48 Cr 1.2')).toBe('U 48 (74) Cr 1.2 (1.8)');
  });

  it('omite una variación trivial de creatinina', () => {
    expect(run('Cr 0.30', 'Cr 0.31')).toBe('Cr 0.31');
  });

  it('reduce la historia de PCR a un previo', () => {
    expect(run('PCR 193 (125)(31)', 'PCR 120')).toBe('PCR 120 (193)');
  });

  it('no agrega paréntesis triviales en una lista completa', () => {
    expect(
      run('Hto 27.8 Hb 9.1 Plaq 210m Cr 0.30', 'Hto 28.1 Hb 9.3 Plaq 215m Cr 0.31'),
    ).toBe('Hto 28.1 Hb 9.3 Plaq 215m Cr 0.31');
  });

  it('conserva un estudio especial no repetido sin mutilarlo', () => {
    expect(run('LDH 790 (941)', 'Hb 10')).toBe('LDH 790 (941) Hb 10');
  });
});

describe('intervenciones', () => {
  it('conserva una transfusión previa de UGR', () => {
    expect(run('Hb 6.2+2UGR', 'Hb 7')).toBe('Hb 7 (6.2+2UGR)');
  });

  it('agrega una transfusión actual y conserva la anterior', () => {
    expect(run('Hb 6.2+2UGR', 'Hb 7\nSe transfunde 1 UGR')).toBe(
      'Hb 7+1 UGR (6.2+2UGR)',
    );
  });

  it('conserva el previo crítico ante transfusión de plaquetas', () => {
    expect(run('Plaq 15m', 'Plaq <10m+8UP')).toBe('Plaq <10m+8UP (15m)');
  });

  it('conserva un ionograma previo con reposición', () => {
    expect(run('Iono 136/3.0(+K)/101', 'Iono 139/3.8/103')).toBe(
      'Iono 139/3.8/103 (136/3.0(+K)/101)',
    );
  });

  it('conserva fósforo previo con reposición', () => {
    expect(run('P 2.8(+P)', 'P 3.5')).toBe('P 3.5 (2.8(+P))');
  });

  it('conserva magnesio previo con reposición', () => {
    expect(run('Mg 1.4(+Mg)', 'Mg 1.9')).toBe('Mg 1.9 (1.4(+Mg))');
  });

  it('agrega reposición actual de potasio dentro del ionograma', () => {
    expect(run('Iono 135/3.1/100', 'Iono 138/2.9/97\nK: +K')).toBe(
      'Iono 138/2.9(+K)/97 (135/3.1/100)',
    );
  });
});

describe('parámetros secundarios', () => {
  it('omite albúmina previa trivial', () => {
    expect(run('Alb 2.8', 'Alb 2.9')).toBe('Alb 2.9');
  });

  it('omite calcio previo trivial', () => {
    expect(run('Ca 8.6', 'Ca 8.7')).toBe('Ca 8.7');
  });

  it('prioriza intervención de fósforo y omite albúmina previa', () => {
    expect(run('Alb 2.5 P 2.1(+P)', 'Alb 2.6 P 3.0')).toBe(
      'Alb 2.6 P 3.0 (2.1(+P))',
    );
  });
});

describe('hemograma y hepatograma', () => {
  it('mantiene diferencial relevante asociado a GB', () => {
    expect(run('GB 14.2m 88%N', 'GB 9.8m\nN 78%')).toBe(
      'GB 9.8m 78%N (14.2m 88%N)',
    );
  });

  it('expresa blastos y elimina N0%', () => {
    expect(run('', 'GB 16.09m\nN 0%\nB 100%')).toBe('GB 16m B100%');
  });

  it('normaliza hepatograma histórico normal', () => {
    expect(run('Hb 10 Hepato s/p', '')).toBe('Hb 10 Hep sp');
  });

  it('genera Hep sp con componentes habituales', () => {
    expect(run('', 'BD 0.27\nBT 0.44\nGOT 19\nGPT 10\nFA 72')).toBe('Hep sp');
  });

  it('mantiene valores de hepatograma alterado', () => {
    expect(run('', 'BD 0.21\nBT 0.32\nGOT 42\nGPT 60\nFA 123')).toBe(
      'Hep 0.21/0.32/42/60/123',
    );
  });
});

describe('laboratorio crudo', () => {
  const report = `
| HEMATOCRITO | **24.4** | **↓** | % |
| HEMOGLOBINA | **8.2** | **↓** | g/dl |
| RECUENTO DE GLOBULOS BLANCOS | **12.11** | **↑** | mil/mm3 |
| NEUTROFILOS | **27** | % |
| BLASTOS | **69** | % |
| PLAQUETAS RECUENTO | **36** | **↓** | mil/mm3 |
| SODIO | **143** | mEq/l |
| POTASIO | **3.7** | mEq/l |
| CLORO | **109** | **↑** | mEq/l |
| UREA EN SANGRE | **25** | mg/dl |
| CREATININA EN SANGRE | **0.84** | mg/dl |
| ACIDO URICO EN SANGRE | **2.3** | **↓** | mg/dl |
| CALCIO EN SANGRE | **8.3** | **↓** | mg/dl |
| FOSFORO EN SANGRE | **2.3** | **↓** | mg/dl |
| BILIRRUBINA DIRECTA | **0.21** | mg/dl |
| BILIRRUBINA TOTAL | **0.32** | mg/dl |
| ASPARTATO AMINOTRANSFERASA | **42** | **↑** | UI/l |
| ALANINA AMINOTRANSFERASA | **60** | **↑** | UI/l |
| FOSFATASA ALCALINA SERICA | **123** | **↑** | UI/l |
| ALBUMINA | **3.46** | **↓** | g/dl |
`;

  it('extrae los campos centrales e ignora unidades', () => {
    const output = run('', report);
    expect(output).toContain('Hto 24.4 Hb 8.2 GB 12.11m B69% Plaq 36m U 25 Cr 0.84 Iono 143/3.7/109');
    expect(output).not.toContain('mg/dl');
  });

  it('mantiene minerales anormales y hepatograma alterado', () => {
    const output = run('', report);
    expect(output).toContain('Ca 8.3 P 2.3 Hep 0.21/0.32/42/60/123');
    expect(output).toContain('Alb 3.46 Ac úrico 2.3');
  });
});

describe('microbiología', () => {
  it('reemplaza pendiente por resultado definitivo de la misma muestra', () => {
    expect(
      run(
        'Hb 10 UC 16/9: pendiente. HC 16/9: pendiente.',
        '',
        'UC 16/9: E. coli BLEE.\nHC 16/9: sin desarrollo.',
      ),
    ).toBe('Hb 10 UC 16/9: E. coli BLEE. HC 16/9: neg.');
  });

  it('hereda la fecha sólo con una muestra pendiente inequívoca', () => {
    expect(run('UC 16/9: pendiente.', '', 'UC: E. coli BLEE.')).toBe(
      'UC 16/9: E. coli BLEE.',
    );
  });
});

describe('imágenes', () => {
  it('no inventa fecha en una TC protocolo TEP negativa', () => {
    expect(run('', '', 'TC protocolo TEP sin fecha: Sin TEP.')).toBe('TC Tx c/: sin TEP');
  });

  it('usa exclusivamente la sigla TEP', () => {
    const output = run('', '', 'TC protocolo TEP: no se identifican signos de tromboembolismo pulmonar.');
    expect(output).toBe('TC Tx c/: sin TEP');
    expect(output).not.toMatch(/\b(?:SEP|TP)\b/);
  });

  it('reemplaza un TEP previo por control negativo evolutivo', () => {
    expect(
      run(
        'TC Tx c/: TEP subsegmentario LID + OVE bibasales.',
        '',
        'TC protocolo TEP: Sin TEP. Resolución de opacidades bibasales.',
      ),
    ).toBe('TC Tx c/: sin TEP. Resolución OVE bibasales.');
  });

  it('resume un TEP positivo y el proceso pulmonar', () => {
    expect(
      run(
        '',
        '',
        'TC protocolo TEP: TEP en ramas segmentarias/subsegmentarias posterobasales de LID. Proceso inflamatorio/infeccioso LSI.',
      ),
    ).toBe('TC Tx c/: TEP segment/subsegment posterobasal LID. OVE LSI');
  });

  it('resume el patrón canónico de hemorragia digestiva', () => {
    expect(
      run(
        '',
        '',
        'AngioTC 14/9: Imagen focal milimétrica en fondo cecal hiperdensa en fase arterial y venosa temprana, con lavado tardío, asociada a contenido hiperdenso en íleon distal.',
      ),
    ).toBe(
      'AngioTC 14/9: imagen en fondo cecal, hiperdensa fase art/venosa temp con lavado en fase tardía + cont hiperdenso en íleon distal',
    );
  });

  it('resume celulitis preseptal por TC', () => {
    expect(
      run(
        '',
        '',
        'TC senos paranasales: Celulitis preseptal bilateral + dacriocistitis izquierda + desviación septal + hipertrofia de cornete inferior izquierdo.',
      ),
    ).toBe(
      'TC senos paranasales: Celulitis preseptal bilat + dacriocistitis izq + desv septal a doble curvatura + hipertrofia cornete inferior izq',
    );
  });

  it('resume el control evolutivo del derrame pericárdico', () => {
    expect(
      run(
        '',
        '',
        'TC Tx: Derrame pericárdico 21 mm con realce de hojas parietales; previo 35 mm. NTX laminar izquierdo. Dilatación VB IH con probables quistes peribiliares. Quiste pancreático en cuerpo.',
      ),
    ).toBe(
      'TC Tx: < derrame pericárdico realce hojas pariet (21 mm) (previo 35 mm). NTX laminar izq. Dilat VB IH + probables quistes peribiliares. Imag quistica cuerpo páncreas',
    );
  });

  it('marca como revisión un informe libre no soportado y no lo inventa', () => {
    const result = reconcile({
      yesterday: 'TC AP: ascitis leve.',
      todayLab: '',
      todayStudies: 'Informe complejo sin patrón implementado.',
    });
    expect(result.output).toBe('TC AP: ascitis leve.');
    expect(result.warnings.some((warning) => warning.code === 'IMG_REVIEW')).toBe(true);
  });
});

describe('privacidad y contrato', () => {
  it('produce una sola línea', () => {
    expect(run('Hb 9\nCr 1', 'Hb 8\nCr 1.5')).not.toMatch(/[\r\n]/);
  });

  it('no agrega una fecha actual', () => {
    expect(run('', '', 'TC protocolo TEP: Sin TEP.')).not.toContain('18/9');
  });

  it('devuelve salida vacía sin inventar datos', () => {
    expect(run()).toBe('');
  });
});
