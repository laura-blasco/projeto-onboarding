import * as XLSX from 'xlsx';
import { SPE, Workflow, Task, Status, Phase, Responsibility, JourneyMilestone } from '../types';
import { calculateMilestoneStatus } from './engine';

// --- 1. RAW INTERFACES (Mapping exact Excel Columns) ---

interface RawProcessRow {
  process_id: string | number;
  nome_processo: string;
  razao_social_cliente: string;
  razao_social_da_spe: string;
  cnpj_da_spe: string;
  erp: string;
  codigo_uau: string;
  cidade: string;
  uf: string;
  status_jornada_cliente: string;
  data_inicio_processo: any;
  // Milestones columns (flexible mapping)
  data_conclusao_kickoff?: any;
  data_conclusao_viabilidade?: any;
  data_conclusao_financeiro?: any;
  data_conclusao_carteira?: any;
}

interface RawTrackRow {
  process_id: string | number;
  esteira: string; // The join key for tasks
  status_esteira_detalhado: string;
  sla_esteira_dias: number;
  data_inicio: any;
  data_conclusao: any;
}

interface RawTaskRow {
  task_id: string | number;
  process_id: string | number;
  nome_tarefa: string;
  esteira: string; // Grouping key
  Responsabilidade: string; // "TRINUS" | "CLIENTE"
  status_real: string;
  data_prazo_sla: any;
  conclusao_tarefa: any;
  criacao_tarefa: any;
  comentario_resolucao_pendencia: string;
  SLA_dias_uteis_padrao: number;
}

// --- 2. NORMALIZATION HELPERS ---

const normalizeDate = (val: any): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel Serial Date
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
};

const normalizePhase = (rawName: string): Phase => {
  const lower = rawName?.toLowerCase() || '';
  if (lower.includes('viab')) return Phase.VIABILITY;
  if (lower.includes('jurid') || lower.includes('juríd')) return Phase.JURIDICAL;
  if (lower.includes('finan')) return Phase.FINANCIAL;
  if (lower.includes('engenh')) return Phase.ENGINEERING;
  if (lower.includes('integ') || lower.includes('cart')) return Phase.INTEGRATION;
  return Phase.VIABILITY; // Default fallback
};

const normalizeStatus = (raw: string, deadline?: Date, completion?: Date): Status => {
  if (completion) return Status.COMPLETED;
  const lower = raw?.toString().toLowerCase() || '';
  
  if (lower.includes('bloq')) return Status.BLOCKED;
  if (lower.includes('conclu')) return Status.COMPLETED;
  
  // Calculated status
  if (deadline && new Date() > deadline) return Status.DELAYED;
  if (lower.includes('atras')) return Status.DELAYED;
  if (lower.includes('risco')) return Status.AT_RISK;
  
  return Status.ON_TRACK;
};

const mapResponsibility = (raw: string): Responsibility => {
  const upper = raw?.toString().toUpperCase() || '';
  if (upper.includes('CLIENTE')) return 'CLIENT';
  if (upper.includes('TERCEIRO') || upper.includes('CARTORIO')) return 'THIRD_PARTY';
  return 'TRINUS';
};

// --- 3. MAIN PARSER ---

const readSheet = async <T>(file: File): Promise<T[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    // Assume data is in the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet) as T[];
};

export const parseDataFromFiles = async (
    files: { processFile: File, trackFile: File, taskFile: File }
): Promise<SPE[]> => {

  // Load all 3 files in parallel
  const [rawProcesses, rawTracks, rawTasks] = await Promise.all([
      readSheet<RawProcessRow>(files.processFile),
      readSheet<RawTrackRow>(files.trackFile),
      readSheet<RawTaskRow>(files.taskFile)
  ]);

  const speMap = new Map<string, SPE>();

  // --- STEP 1: LOAD HEAD (PROCESSES) ---
  rawProcesses.forEach(row => {
    if (!row.process_id) return;
    const procId = row.process_id.toString();

    // Map Milestones (Using specific columns if available, or deducing)
    const startDate = normalizeDate(row.data_inicio_processo) || new Date();
    
    // TtV Logic: Try to find completion dates
    const msKickoff = normalizeDate(row.data_conclusao_kickoff);
    const msViab = normalizeDate(row.data_conclusao_viabilidade);
    const msFin = normalizeDate(row.data_conclusao_financeiro);
    const msCart = normalizeDate(row.data_conclusao_carteira);

    const getDeadline = (days: number) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + days);
        return d;
    };

    const milestones: JourneyMilestone[] = [
        { key: 'kickoff', label: 'Kick-off', status: calculateMilestoneStatus(msKickoff, getDeadline(5)), date: msKickoff, deadline: getDeadline(5) },
        { key: 'viab', label: 'Viabilidade', status: calculateMilestoneStatus(msViab, getDeadline(20)), date: msViab, deadline: getDeadline(20) },
        { key: 'fin', label: 'Financeiro', status: calculateMilestoneStatus(msFin, getDeadline(45)), date: msFin, deadline: getDeadline(45) },
        { key: 'cart', label: 'Carteira', status: calculateMilestoneStatus(msCart, getDeadline(60)), date: msCart, deadline: getDeadline(60) },
    ];

    const spe: SPE = {
      id: `spe-${procId}`,
      processId: procId,
      name: row.razao_social_da_spe || row.nome_processo || 'SPE Desconhecida',
      groupName: row.razao_social_cliente || 'Grupo Desconhecido',
      startDate: startDate,
      workflows: [],
      overallStatus: Status.ON_TRACK,
      tags: [row.status_jornada_cliente || 'Onboarding'],
      updates: [],
      metadata: {
        cnpj: row.cnpj_da_spe || '',
        erpId: row.erp || '',
        uauId: row.codigo_uau || '',
        city: row.cidade || '',
        uf: row.uf || ''
      },
      milestones: milestones,
      lastActivityDate: new Date()
    };

    speMap.set(procId, spe);
  });

  // --- STEP 2: LOAD TRACKS (ESTEIRAS) ---
  rawTracks.forEach(row => {
    if (!row.process_id) return;
    const procId = row.process_id.toString();
    const spe = speMap.get(procId);

    if (spe) {
      spe.workflows.push({
        id: `wf-${procId}-${row.esteira}`,
        phase: normalizePhase(row.esteira),
        progress: 0, // Calculated later
        tasks: [],
        leadTime: row.sla_esteira_dias || 15
      });
    }
  });

  // --- STEP 3: LOAD TASKS & HANDLE ORPHANS ---
  rawTasks.forEach(row => {
    if (!row.process_id) return;
    const procId = row.process_id.toString();
    
    let spe = speMap.get(procId);

    // Orphan Handling: Create Ghost Parent
    if (!spe) {
      spe = {
         id: `ghost-${procId}`,
         processId: procId,
         name: `[Orphan] Process ${procId}`,
         groupName: 'Integrity Check Failed',
         startDate: new Date(),
         workflows: [],
         overallStatus: Status.AT_RISK,
         tags: ['ORPHAN_DATA'],
         updates: [],
         metadata: { cnpj: '?', erpId: '?', uauId: '?', city: '?', uf: '?' },
         milestones: [],
         lastActivityDate: new Date()
      };
      speMap.set(procId, spe);
    }

    // Identify Workflow (Track)
    const trackName = row.esteira || 'Geral';
    const phase = normalizePhase(trackName);
    
    // Find matching workflow by Phase (preferred) or create Ad-Hoc
    let workflow = spe.workflows.find(w => w.phase === phase);
    
    if (!workflow) {
      workflow = {
        id: `wf-adhoc-${procId}-${phase}`,
        phase: phase,
        progress: 0,
        tasks: [],
        leadTime: row.SLA_dias_uteis_padrao || 10
      };
      spe.workflows.push(workflow);
    }

    // Create Task Object
    const dueDate = normalizeDate(row.data_prazo_sla) || new Date();
    const completionDate = normalizeDate(row.conclusao_tarefa);
    const creationDate = normalizeDate(row.criacao_tarefa) || new Date();

    const task: Task = {
      id: row.task_id?.toString() || `task-${Math.random()}`,
      name: row.nome_tarefa || 'Tarefa sem nome',
      assignee: 'Analista',
      responsibility: mapResponsibility(row.Responsabilidade),
      startDate: creationDate,
      dueDate: dueDate,
      completedDate: completionDate,
      status: normalizeStatus(row.status_real, dueDate, completionDate),
      comments: row.comentario_resolucao_pendencia || '',
      isCritical: false
    };

    workflow.tasks.push(task);
  });

  // --- STEP 4: AGGREGATE METRICS ---
  return Array.from(speMap.values()).map(spe => {
    let speDelayedCount = 0;
    
    // Sort workflows by standard phase order
    const phaseOrder = Object.values(Phase);
    spe.workflows.sort((a,b) => phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase));

    spe.workflows.forEach(wf => {
      const total = wf.tasks.length;
      if (total === 0) {
        wf.progress = 0;
      } else {
        const done = wf.tasks.filter(t => t.status === Status.COMPLETED).length;
        wf.progress = Math.round((done / total) * 100);
        
        const delayed = wf.tasks.filter(t => t.status === Status.DELAYED).length;
        speDelayedCount += delayed;
      }
    });

    // Determine Overall Status
    if (speDelayedCount > 2) spe.overallStatus = Status.DELAYED;
    else if (speDelayedCount > 0) spe.overallStatus = Status.AT_RISK;
    else if (spe.workflows.every(w => w.progress === 100) && spe.workflows.length > 0) spe.overallStatus = Status.COMPLETED;
    else spe.overallStatus = Status.ON_TRACK;

    return spe;
  });
};