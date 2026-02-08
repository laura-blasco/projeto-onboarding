export enum Status {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  DELAYED = 'DELAYED',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED'
}

export enum Phase {
  VIABILITY = 'Viabilidade',
  JURIDICAL = 'Jurídico',
  FINANCIAL = 'Financeiro',
  ENGINEERING = 'Engenharia',
  INTEGRATION = 'Integração'
}

export type Responsibility = 'TRINUS' | 'CLIENT' | 'THIRD_PARTY';

export interface Task {
  id: string;
  name: string;
  assignee: string;
  responsibility: Responsibility; 
  startDate: Date;
  dueDate: Date;
  completedDate?: Date;
  status: Status;
  comments: string; // Used for root cause analysis
  isCritical: boolean;
}

export interface Workflow {
  id: string;
  phase: Phase;
  progress: number; // 0-100
  tasks: Task[];
  leadTime: number; // calculated in days
}

export interface UpdateLog {
  id: string;
  date: Date;
  author: string;
  type: 'GENERAL' | 'BLOCKER' | 'PROGRESS';
  content: string;
}

// TtV Milestones
export type MilestoneStatus = 'COMPLETED' | 'PENDING' | 'DELAYED';

export interface JourneyMilestone {
  key: string;
  label: string;
  status: MilestoneStatus;
  date?: Date; // If exists, it is completed
  deadline?: Date; // Used to calculate DELAYED if date is missing
}

export interface SPEMetadata {
  cnpj: string;
  erpId: string;
  uauId: string;
  city: string;
  uf: string;
}

export interface SPE {
  id: string;
  processId: string; // PK for ETL merging
  name: string; // e.g., SPE Jardim das Flores
  groupName: string; // e.g., Construtora X
  startDate: Date;
  workflows: Workflow[];
  overallStatus: Status;
  tags: string[];
  updates: UpdateLog[]; // History of reports/comments (Persisted in LocalStorage)
  
  // New Fields for V2
  metadata: SPEMetadata;
  milestones: JourneyMilestone[]; // Derived from Excel Data
  lastActivityDate: Date;
}

export interface DashboardMetrics {
  totalSPEs: number;
  delayedSPEs: number;
  avgSLAAdherence: number;
  avgOnboardingTime: number;
}
