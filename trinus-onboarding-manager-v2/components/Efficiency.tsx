import React from 'react';
import { SPE, Task, Status } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';
import { calculateTaskAging, analyzeRootCause } from '../services/engine';

interface EfficiencyProps {
  data: SPE[];
}

export const Efficiency: React.FC<EfficiencyProps> = ({ data }) => {
  // 1. Prepare Aging Data
  const allTasks: Task[] = data.flatMap(spe => spe.workflows.flatMap(wf => wf.tasks));
  const openTasks = allTasks.filter(t => t.status !== Status.COMPLETED);
  
  const agingBuckets = {
    '0-7 dias': 0,
    '8-15 dias': 0,
    '15-30 dias': 0,
    '30+ dias': 0
  };

  openTasks.forEach(task => {
    const age = calculateTaskAging(task);
    if (age <= 7) agingBuckets['0-7 dias']++;
    else if (age <= 15) agingBuckets['8-15 dias']++;
    else if (age <= 30) agingBuckets['15-30 dias']++;
    else agingBuckets['30+ dias']++;
  });

  const agingChartData = Object.keys(agingBuckets).map(key => ({
    name: key,
    tasks: agingBuckets[key as keyof typeof agingBuckets]
  }));

  // 2. Root Cause & Responsibility Analysis
  const delayedTasks = allTasks.filter(t => (t.status === Status.DELAYED || t.status === Status.BLOCKED));
  
  const rootCauses = delayedTasks.reduce((acc, task) => {
    const cause = analyzeRootCause(task.comments || '');
    acc[cause] = (acc[cause] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const rootCauseData = Object.keys(rootCauses).map(key => ({
    cause: key,
    count: rootCauses[key]
  })).sort((a, b) => b.count - a.count);

  // Responsibility Data
  const responsibilityCounts = delayedTasks.reduce((acc, task) => {
    acc[task.responsibility] = (acc[task.responsibility] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const respData = [
    { name: 'Trinus (Plataforma/Ops)', value: responsibilityCounts['TRINUS'] || 0, color: '#6366f1' },
    { name: 'Cliente (Doc/Info)', value: responsibilityCounts['CLIENT'] || 0, color: '#f59e0b' },
    { name: 'Externo', value: responsibilityCounts['THIRD_PARTY'] || 0, color: '#94a3b8' }
  ].filter(d => d.value > 0);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Eficiência e SLA</h2>
           <p className="text-sm text-slate-500">Análise de tempos de resposta e gargalos estruturais.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Aging Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Envelhecimento de Tarefas</h3>
              <p className="text-sm text-slate-500">Distribuição da duração de tarefas abertas</p>
            </div>
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
              {openTasks.length} Tarefas Abertas
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="tasks" radius={[4, 4, 0, 0]}>
                  {agingChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 2 ? '#ef4444' : (index > 1 ? '#f59e0b' : '#6366f1')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Responsibility Split */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Responsabilidade por Atrasos</h3>
              <p className="text-sm text-slate-500">Com quem está a pendência?</p>
            </div>
          </div>
           <div className="h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={respData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {respData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Root Cause Analysis */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Diagnóstico: Principais Bloqueios</h3>
              <p className="text-sm text-slate-500">Classificação automática de motivos de atraso via comentários.</p>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rootCauseData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="cause" type="category" width={120} tick={{fontSize: 11, fontWeight: 500}} />
                <Tooltip />
                <Bar dataKey="count" fill="#f43f5e" barSize={24} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Task List */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-rose-50/50">
          <h3 className="text-lg font-bold text-rose-800">Atenção Crítica Necessária</h3>
          <p className="text-sm text-rose-600">Tarefas marcadas como críticas ou atrasadas há 30+ dias</p>
        </div>
        <div className="divide-y divide-slate-100">
          {openTasks.filter(t => t.isCritical || calculateTaskAging(t) > 30).slice(0, 5).map((task, i) => (
            <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50">
              <div className="mb-2 md:mb-0">
                <div className="flex items-center gap-2">
                  <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold">CRÍTICO</span>
                  <span className="font-semibold text-slate-800 text-sm">{task.name}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-1">Resp: {task.assignee} • Prazo: {task.dueDate.toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${task.responsibility === 'TRINUS' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                  {task.responsibility === 'TRINUS' ? 'Trinus' : (task.responsibility === 'CLIENT' ? 'Cliente' : 'Terceiro')}
                </span>
                <span className="text-slate-500">Idade: <span className="font-mono font-bold text-slate-700">{calculateTaskAging(task)}d</span></span>
              </div>
            </div>
          ))}
          {openTasks.filter(t => t.isCritical || calculateTaskAging(t) > 30).length === 0 && (
             <div className="p-6 text-center text-slate-400 text-sm">Nenhuma tarefa crítica encontrada. Bom trabalho!</div>
          )}
        </div>
      </div>
    </div>
  );
};