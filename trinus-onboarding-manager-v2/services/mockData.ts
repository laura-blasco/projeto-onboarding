import { SPE, Phase, Status, Workflow, Task, UpdateLog, Responsibility, JourneyMilestone, SPEMetadata } from '../types';
import { calculateMilestoneStatus } from './engine';

const generateRandomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const groups = ['Construtora Alpha', 'Incorporadora Beta', 'Grupo Gama', 'Urbanismo Delta'];
const speNames = ['Residencial Ouro Verde', 'Lot. Morada do Sol', 'Cond. Vista Alegre', 'Reserva das Flores', 'Torre Corporate', 'Vila Nova II', 'Jardins da Barra', 'Portal do Lago', 'Residencial Horizonte', 'EcoVille I'];
const cities = ['Goiânia', 'São Paulo', 'Campinas', 'Uberlândia', 'Palmas'];
const ufs = ['GO', 'SP', 'SP', 'MG', 'TO'];

const authors = ['João Silva', 'Maria Costa', 'Pedro Santos'];

const createTasks = (phase: Phase): Task[] => {
  const tasks: Task[] = [];
  const count = Math.floor(Math.random() * 3) + 2; 

  for (let i = 0; i < count; i++) {
    const isCompleted = Math.random() > 0.4;
    const isDelayed = !isCompleted && Math.random() > 0.6;
    const hasComments = Math.random() > 0.7;

    let comment = '';
    if (hasComments) {
      const reasons = ['Falta assinatura do doc', 'Erro no acesso ao sistema', 'Aguardando cliente retornar', 'Documentação pendente'];
      comment = reasons[Math.floor(Math.random() * reasons.length)];
    }

    let responsibility: Responsibility = 'TRINUS';
    if (comment.includes('cliente') || comment.includes('assinatura') || Math.random() > 0.7) {
      responsibility = 'CLIENT';
    }

    tasks.push({
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      name: `${phase} - Etapa ${i + 1}`,
      assignee: responsibility === 'TRINUS' ? 'Analista Trinus' : 'Cliente POC',
      responsibility,
      startDate: generateRandomDate(new Date(2023, 8, 1), new Date()),
      dueDate: generateRandomDate(new Date(), new Date(2024, 0, 1)),
      completedDate: isCompleted ? new Date() : undefined,
      status: isCompleted ? Status.COMPLETED : (isDelayed ? Status.DELAYED : Status.ON_TRACK),
      comments: comment,
      isCritical: Math.random() > 0.8
    });
  }
  return tasks;
};

const createUpdates = (count: number): UpdateLog[] => {
  const updates: UpdateLog[] = [];
  const types: ('GENERAL' | 'BLOCKER' | 'PROGRESS')[] = ['GENERAL', 'BLOCKER', 'PROGRESS'];
  
  for(let i=0; i<count; i++) {
    updates.push({
      id: `log-${Math.random().toString(36).substr(2,9)}`,
      date: generateRandomDate(new Date(2023, 10, 1), new Date()),
      author: authors[Math.floor(Math.random() * authors.length)],
      type: types[Math.floor(Math.random() * types.length)],
      content: "Atualização de status do projeto referente à etapa de validação jurídica e financeira."
    });
  }
  return updates.sort((a,b) => b.date.getTime() - a.date.getTime());
};

const generateMilestones = (workflows: Workflow[]): JourneyMilestone[] => {
    // Helper to extract completion date from a phase workflow
    const getPhaseCompletion = (phase: Phase): Date | undefined => {
        const wf = workflows.find(w => w.phase === phase);
        if (wf && wf.progress === 100) return new Date(); // Simulating completion date
        return undefined;
    };

    // Helper to generate a simulated deadline
    const getDeadline = (offsetDays: number) => {
        const d = new Date(2023, 8, 1);
        d.setDate(d.getDate() + offsetDays);
        return d;
    };

    const kickoffDate = new Date(2023, 5, 15);
    const viabDate = getPhaseCompletion(Phase.VIABILITY);
    const finDate = getPhaseCompletion(Phase.FINANCIAL);
    const cartDate = getPhaseCompletion(Phase.INTEGRATION);

    return [
        { 
            key: 'kickoff', 
            label: 'Kick-off', 
            status: calculateMilestoneStatus(kickoffDate, getDeadline(0)), 
            date: kickoffDate,
            deadline: getDeadline(0)
        },
        { 
            key: 'viab', 
            label: 'Viabilidade', 
            status: calculateMilestoneStatus(viabDate, getDeadline(30)), 
            date: viabDate,
            deadline: getDeadline(30)
        },
        { 
            key: 'fin', 
            label: 'Financeiro', 
            status: calculateMilestoneStatus(finDate, getDeadline(60)), 
            date: finDate,
            deadline: getDeadline(60)
        },
        { 
            key: 'cart', 
            label: 'Carteira', 
            status: calculateMilestoneStatus(cartDate, getDeadline(90)), 
            date: cartDate,
            deadline: getDeadline(90)
        },
    ];
};

const generateMetadata = (): SPEMetadata => {
    return {
        cnpj: `${Math.floor(Math.random() * 99)}.${Math.floor(Math.random() * 999)}.${Math.floor(Math.random() * 999)}/0001-${Math.floor(Math.random() * 99)}`,
        erpId: `ERP-${Math.floor(Math.random() * 10000)}`,
        uauId: `UAU-${Math.floor(Math.random() * 5000)}`,
        city: cities[Math.floor(Math.random() * cities.length)],
        uf: ufs[Math.floor(Math.random() * ufs.length)],
    }
}

export const generateMockData = (): SPE[] => {
  return speNames.map((name, index) => {
    const workflows: Workflow[] = Object.values(Phase).map((phase, pIndex) => ({
      id: `wf-${index}-${pIndex}`,
      phase: phase,
      progress: Math.floor(Math.random() * 100),
      tasks: createTasks(phase),
      leadTime: Math.floor(Math.random() * 20) + 5
    }));

    const updates = createUpdates(Math.floor(Math.random() * 5));
    const lastActivityDate = updates.length > 0 ? updates[0].date : new Date();

    const rand = Math.random();
    let overallStatus = Status.ON_TRACK;
    if (rand > 0.7) overallStatus = Status.AT_RISK;
    if (rand > 0.85) overallStatus = Status.DELAYED;

    return {
      id: `spe-${index}`,
      processId: `PROC-${1000 + index}`, // PK
      name: name,
      groupName: groups[index % groups.length],
      startDate: generateRandomDate(new Date(2023, 5, 1), new Date(2023, 8, 1)),
      workflows,
      overallStatus,
      tags: rand > 0.5 ? ['VIP', 'Launch'] : ['Standard'],
      updates,
      metadata: generateMetadata(),
      milestones: generateMilestones(workflows),
      lastActivityDate
    };
  });
};
