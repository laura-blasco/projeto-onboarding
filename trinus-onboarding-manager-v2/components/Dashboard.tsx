import React from 'react';
import { SPE, Status } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';
import { getStatusColor, translateStatus } from '../services/engine';
import { TrendingUp, AlertTriangle, Clock, CheckCircle, ArrowRight } from 'lucide-react';

interface DashboardProps {
  data: SPE[];
  onSelectSPE: (spe: SPE) => void;
}

const MetricCard: React.FC<{ title: string; value: string; trend: string; icon: React.ReactNode; color: string }> = ({ title, value, trend, icon, color }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      <p className={`text-xs mt-2 font-medium ${trend.includes('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend} <span className="text-slate-400 font-normal">vs mês anterior</span>
      </p>
    </div>
    <div className={`p-3 rounded-lg ${color} text-white`}>
      {icon}
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ data, onSelectSPE }) => {
  // Process Data for Charts
  const statusCounts = data.reduce((acc, curr) => {
    acc[curr.overallStatus] = (acc[curr.overallStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = [
    { name: 'Em Dia', value: statusCounts[Status.ON_TRACK] || 0, color: '#10b981' },
    { name: 'Em Risco', value: statusCounts[Status.AT_RISK] || 0, color: '#f59e0b' },
    { name: 'Atrasado', value: statusCounts[Status.DELAYED] || 0, color: '#f43f5e' },
    { name: 'Bloqueado', value: statusCounts[Status.BLOCKED] || 0, color: '#1e293b' },
  ];

  const phaseDataRaw = data.flatMap(d => d.workflows).reduce((acc, wf) => {
    if (wf.progress < 100 && wf.progress > 0) {
      acc[wf.phase] = (acc[wf.phase] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const donutData = Object.keys(phaseDataRaw).map((key) => ({
    name: key,
    value: phaseDataRaw[key]
  }));

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end mb-2">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Visão Geral Executiva</h2>
           <p className="text-sm text-slate-500">Visão macro da saúde do portfólio e gargalos.</p>
        </div>
        <div className="text-xs text-slate-400">Atualizado: Agora mesmo</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="SPEs Ativas" 
          value={data.length.toString()} 
          trend="+12%" 
          icon={<TrendingUp size={20} />} 
          color="bg-indigo-500" 
        />
        <MetricCard 
          title="Lead Time Médio" 
          value="45 Dias" 
          trend="-5%" 
          icon={<Clock size={20} />} 
          color="bg-blue-500" 
        />
        <MetricCard 
          title="Atrasos Críticos" 
          value={statusCounts[Status.DELAYED]?.toString() || "0"} 
          trend="+2" 
          icon={<AlertTriangle size={20} />} 
          color="bg-rose-500" 
        />
        <MetricCard 
          title="Concluídos (Ano)" 
          value="18" 
          trend="+4%" 
          icon={<CheckCircle size={20} />} 
          color="bg-emerald-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Saúde do Portfólio</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phase Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Fases Ativas</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick List */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Atividade Recente e Status</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {data.slice(0, 5).map(spe => (
            <div 
              key={spe.id} 
              onClick={() => onSelectSPE(spe)}
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(spe.overallStatus)}`}></div>
                <div>
                  <div className="flex items-center gap-2">
                     <p className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{spe.name}</p>
                     {spe.updates.length > 0 && <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>}
                  </div>
                  <p className="text-xs text-slate-500">{spe.groupName}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400">Fase Atual</p>
                    <p className="text-sm font-medium text-slate-700">{spe.workflows.find(w => w.progress < 100)?.phase || 'Concluído'}</p>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${spe.overallStatus === Status.DELAYED ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {translateStatus(spe.overallStatus)}
                    </span>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};