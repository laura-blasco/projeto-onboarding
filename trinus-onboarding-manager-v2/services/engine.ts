import { Status, Task, MilestoneStatus } from '../types';

export const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

/**
 * Simplified Working Hours Engine.
 * In a real scenario, this would check a holidays array.
 */
export const calculateDaysDiff = (start: Date, end: Date): number => {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / MILLISECONDS_IN_DAY);
};

export const getStatusColor = (status: Status): string => {
  switch (status) {
    case Status.ON_TRACK: return 'bg-emerald-500';
    case Status.COMPLETED: return 'bg-blue-500';
    case Status.AT_RISK: return 'bg-amber-500';
    case Status.DELAYED: return 'bg-rose-500';
    case Status.BLOCKED: return 'bg-slate-800';
    default: return 'bg-slate-400';
  }
};

export const getStatusText = (status: Status): string => {
  switch (status) {
    case Status.ON_TRACK: return 'text-emerald-700 bg-emerald-50';
    case Status.COMPLETED: return 'text-blue-700 bg-blue-50';
    case Status.AT_RISK: return 'text-amber-700 bg-amber-50';
    case Status.DELAYED: return 'text-rose-700 bg-rose-50';
    case Status.BLOCKED: return 'text-slate-700 bg-slate-100';
    default: return 'text-slate-500';
  }
};

export const translateStatus = (status: Status): string => {
  switch (status) {
    case Status.ON_TRACK: return 'Em Dia';
    case Status.AT_RISK: return 'Em Risco';
    case Status.DELAYED: return 'Atrasado';
    case Status.COMPLETED: return 'Concluído';
    case Status.BLOCKED: return 'Bloqueado';
    default: return status;
  }
};

export const translateResponsibility = (resp: string): string => {
    switch(resp) {
        case 'TRINUS': return 'Trinus';
        case 'CLIENT': return 'Cliente';
        case 'THIRD_PARTY': return 'Terceiro';
        default: return resp;
    }
};

export const calculateTaskAging = (task: Task): number => {
  const end = task.completedDate || new Date();
  return calculateDaysDiff(task.startDate, end);
};

export const analyzeRootCause = (comment: string): string => {
  const lower = comment.toLowerCase();
  if (lower.includes('doc') || lower.includes('assinatura')) return 'Documentação';
  if (lower.includes('acesso') || lower.includes('login')) return 'Acesso/Sistema';
  if (lower.includes('erro') || lower.includes('bug')) return 'Erro Técnico';
  if (lower.includes('aguardando') || lower.includes('cliente')) return 'Cliente';
  return 'Outros';
};

// --- New Logic for TtV ---

/**
 * Determines the color/status of a milestone dot.
 * Green: Completed (Date exists).
 * Red: Pending AND Overdue (Date null & Deadline passed).
 * Gray: Pending (Date null & Deadline future).
 */
export const calculateMilestoneStatus = (completedDate: Date | undefined, deadline: Date | undefined): MilestoneStatus => {
  if (completedDate) return 'COMPLETED';
  
  if (deadline && new Date() > deadline) {
    return 'DELAYED';
  }
  
  return 'PENDING';
};

export const getMilestoneColor = (status: MilestoneStatus): string => {
    switch (status) {
        case 'COMPLETED': return 'bg-emerald-500';
        case 'DELAYED': return 'bg-rose-500';
        case 'PENDING': return 'bg-slate-300';
    }
};