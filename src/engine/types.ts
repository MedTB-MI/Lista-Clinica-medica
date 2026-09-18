export type LabKey =
  | 'hto'
  | 'hb'
  | 'gb'
  | 'plaq'
  | 'u'
  | 'cr'
  | 'iono'
  | 'ca'
  | 'cai'
  | 'p'
  | 'mg'
  | 'eabv'
  | 'eaba'
  | 'eab'
  | 'hep'
  | 'ggt'
  | 'coag'
  | 'pcr'
  | 'vsg'
  | 'ldh'
  | 'alb'
  | 'prot'
  | 'tacrol'
  | 'ac_urico'
  | 'ferritina'
  | 'probnp'
  | 'tsh'
  | 't4l'
  | 't4'
  | 't3'
  | 'glu'
  | 'lactato'
  | 'cpk'
  | 'troponina'
  | 'ckmb'
  | 'dd'
  | 'amilasa'
  | 'lipasa';

export interface LabItem {
  key: LabKey;
  label: string;
  value: string;
  raw: string;
  abnormal?: boolean;
  hasIntervention: boolean;
  components?: string[];
  differential?: {
    neutrophils?: string;
    blasts?: string;
  };
}

export interface ParsedCompactList {
  labs: LabItem[];
  supplemental: SupplementalEntry[];
  unparsedPrefix: string;
}

export interface SupplementalEntry {
  key: string;
  type: 'study' | 'micro' | 'other';
  text: string;
  sampleType?: string;
  date?: string;
  pending?: boolean;
}

export interface ReconcileInput {
  yesterday: string;
  todayLab: string;
  todayStudies: string;
}

export interface ReconcileWarning {
  code: string;
  message: string;
  detail?: string;
}

export interface ReconcileResult {
  output: string;
  warnings: ReconcileWarning[];
  recognized: {
    labs: number;
    studies: number;
    microbiology: number;
  };
}
