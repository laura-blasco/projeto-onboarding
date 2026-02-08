import React, { useMemo } from 'react';
import { SPE, Status } from '../types';
import { getStatusColor, calculateDaysDiff, getMilestoneColor } from '../services/engine';
import { ArrowRight, Building2, Calendar, MapPin, Activity } from 'lucide-react';

interface PortfolioProps {
  data: SPE[];
  onSelectSPE: (spe: SPE) => void;
}

export const Portfolio: React.FC<PortfolioProps> = ({ data, onSelectSPE }) => {
  
  // Group by Client (Group Name)
  const groupedData = useMemo(() => {
    const groups: Record<string, SPE[]> = {};
    data.forEach(spe => {
      if (!groups[spe.groupName]) groups[spe.groupName] = [];
      groups[spe.groupName].push(spe);
    });
    return groups;
  }, [data]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex justify-between items-end mb-2">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Saúde da Carteira (Cockpit)</h2>
           <p className="text-sm text-slate-500">Agrupado por Grupo Econômico. Monitoramento de Tempo de Valor.</p>
        </div>
      </div>

      {Object.entries(groupedData).map(([groupName, spes]) => (
        <div key={groupName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Group Header */}
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{groupName}</h3>
                <span className="text-xs text-slate-500">{spes.length} Projetos Ativos</span>
              </div>
            </div>
          </div>

          {/* Table-like Grid */}
          <div className="divide-y divide-slate-100">
            {spes.map(spe => {
              const daysSinceActivity = calculateDaysDiff(spe.lastActivityDate, new Date());
              
              return (
                <div 
                  key={spe.id} 
                  onClick={() => onSelectSPE(spe)}
                  className="grid grid-cols-12 gap-4 p-5 hover:bg-slate-50 transition-all cursor-pointer group items-center"
                >
                  {/* Info Column */}
                  <div className="col-span-12 lg:col-span-4">
                    <div className="flex items-start gap-3">
                       <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(spe.overallStatus)}`}></div>
                       <div>
                         <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{spe.name}</h4>
                         <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-mono bg-slate-100 px-1 rounded text-slate-600">{spe.metadata.cnpj}</span>
                            <span className="flex items-center gap-1"><MapPin size={10}/> {spe.metadata.city}/{spe.metadata.uf}</span>
                         </div>
                       </div>
                    </div>
                  </div>

                  {/* Journey Bar (TtV) - Traffic Light Logic */}
                  <div className="col-span-12 lg:col-span-5 flex flex-col justify-center px-4 border-l border-r border-slate-100/50">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                       <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tempo de Valor (TtV)</span>
                    </div>
                    <div className="flex items-center gap-1 w-full relative">
                       {/* Connector Line */}
                       <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-slate-100 -z-0"></div>
                       
                       {spe.milestones.map((ms, idx) => (
                         <div key={idx} className="flex-1 flex flex-col items-center gap-1 group/ms relative z-10">
                            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors ${getMilestoneColor(ms.status)}`}></div>
                            <span className={`text-[9px] font-medium truncate max-w-[60px] ${
                                ms.status === 'COMPLETED' ? 'text-emerald-700' : 'text-slate-400'
                            }`}>
                                {ms.label}
                            </span>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover/ms:block bg-slate-800 text-white text-xs rounded py-1 px-2 z-20 whitespace-nowrap shadow-lg">
                               Status: {ms.status} <br/>
                               {ms.date ? `Feito: ${ms.date.toLocaleDateString()}` : `Prazo: ${ms.deadline?.toLocaleDateString() || 'N/A'}`}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>

                  {/* Status & Activity */}
                  <div className="col-span-12 lg:col-span-3 flex items-center justify-end gap-6">
                     <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 uppercase font-semibold">
                            <Activity size={10} /> Atividade
                        </div>
                        <div className={`text-xs font-medium ${daysSinceActivity > 5 ? 'text-rose-600' : 'text-slate-600'}`}>
                           {daysSinceActivity === 0 ? 'Hoje' : `${daysSinceActivity}d atrás`}
                        </div>
                     </div>
                     
                     <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                        Abrir Oper. <ArrowRight size={14} />
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};