
export interface ContentPDA {
  t: string;
  pda: string;
}

export interface ProjectData {
  selectedName: string;
  nameOptions: string[];
  selectedProduct: string;
  productsAvailable: string[];
  description: string;
  strategy: string;
  selectedAxes: string[];
  selectedTraits: string[];
  orientations: string[];
  evaluation: string[];
}

export interface AppData {
  teacher: string;
  field: string;
  discipline: string;
  grade: string;
  methodology: string;
  context: string;
  problems: string[];
  dosification: Record<number, ContentPDA[]>;
  projects: Record<number, ProjectData>;
}
