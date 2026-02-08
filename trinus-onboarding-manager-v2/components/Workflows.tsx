import React, { useState } from 'react';
import { SPE, Phase } from '../types';
import { ChevronDown, Filter, Search, ArrowRight } from 'lucide-react';

interface WorkflowsProps {
  data: SPE[];
  onSelectSPE: (spe: SPE) => void;
}

export const Workflows: React.FC<WorkflowsProps> = ({ data, onSelectSPE }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<Phase | 'All'>('All');

  const filteredData = data.filter(spe => {
    const matchesSearch = spe.name.toLowerCase().includes(searchTerm.toLowerCase()) || spe.groupName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    if (phaseFilter === 'All') return true;
    const currentWf = spe.workflows.find(w => w.progress < 100);
    return currentWf?.phase === phaseFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Esteiras Operacionais</h2>
           <p className="text-sm text-slate-500">Acompanhe o progresso por fase e identifique gargalos.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por SPE ou Grupo..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-slate-500" />
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value as Phase | 'All')}
          >
            <option value="All">Todas as Fases</option>
            {Object.values(Phase).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold">Nome da SPE</th>
                <th scope="col" className="px-6 py-4 font-bold">Grupo</th>
                {Object.values(Phase).map(phase => (
                  <th key={phase} scope="col" className="px-6 py-4 text-center font-semibold text-slate-600">
                    {phase}
                  </th>
                ))}
                <th scope="col" className="px-6 py-4 font-bold text-right">Lead Time</th>
                <th scope="col" className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((spe) => (
                <tr 
                  key={spe.id} 
                  onClick={() => onSelectSPE(spe)}
                  className="bg-white hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap group-hover:text-indigo-600">
                    {spe.name}
                  </td>
                  <td className="px-6 py-4">
                    {spe.groupName}
                  </td>
                  {spe.workflows.map((wf) => (
                    <td key={wf.id} className="px-6 py-4 text-center">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden relative group/bar">
                        <div 
                          className={`h-2.5 rounded-full ${wf.progress === 100 ? 'bg-emerald-500' : (wf.progress > 50 ? 'bg-indigo-500' : 'bg-slate-400')}`} 
                          style={{ width: `${wf.progress}%` }}
                        ></div>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/bar:block bg-slate-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                          {wf.progress}% Concluído
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 block">{wf.leadTime}d</span>
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right font-medium text-slate-900">
                    {spe.workflows.reduce((acc, curr) => acc + curr.leadTime, 0)} dias
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            Nenhuma SPE encontrada com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
};