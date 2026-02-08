import React from 'react';
import { SPE } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  data: SPE[];
}

export const CalendarView: React.FC<CalendarProps> = ({ data }) => {
  // Simplification: We will just show a fixed 14-day window for the demo
  // In a real app, this would need complex date manipulation state
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
      {/* Calendar Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-slate-800">Linha do Tempo</h3>
          <div className="flex bg-white rounded-md border border-slate-200 p-1">
            <button className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
            <span className="px-3 text-sm font-medium text-slate-600 self-center">Próximos 14 Dias</span>
            <button className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex gap-3 text-xs">
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 rounded"></div> Planejado</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div> Concluído</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="min-w-[1000px]">
          {/* Header Row */}
          <div className="grid grid-cols-[250px_repeat(14,1fr)] border-b border-slate-100 sticky top-0 bg-white z-10">
            <div className="p-3 font-semibold text-slate-500 text-xs uppercase tracking-wider bg-slate-50 border-r border-slate-100">
              Projeto / Fase
            </div>
            {days.map((day, i) => (
              <div key={i} className={`p-2 text-center border-r border-slate-100 ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50' : ''}`}>
                <div className="text-xs text-slate-400">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                <div className={`text-sm font-bold ${day.getDate() === today.getDate() ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {data.slice(0, 10).map((spe) => (
              <React.Fragment key={spe.id}>
                {/* Project Row */}
                <div className="grid grid-cols-[250px_repeat(14,1fr)] hover:bg-slate-50/50">
                  <div className="p-3 border-r border-slate-100 flex items-center gap-2">
                    <div className="font-semibold text-sm text-slate-800 truncate">{spe.name}</div>
                  </div>
                  <div className="col-span-14 bg-slate-50/30"></div> 
                </div>
                
                {/* Phase Sub-rows */}
                {spe.workflows.map((wf) => (
                  <div key={wf.id} className="grid grid-cols-[250px_repeat(14,1fr)] group">
                    <div className="p-2 pl-8 border-r border-slate-100 text-xs text-slate-500 flex items-center">
                       {wf.phase}
                    </div>
                    
                    {/* Simplified Gantt Bars logic: Just randomize bar position for demo visual */}
                    <div className="col-span-14 relative h-8 border-b border-slate-50 border-dashed">
                      {/* Grid lines */}
                       <div className="absolute inset-0 grid grid-cols-14 w-full h-full pointer-events-none">
                          {days.map((_, idx) => (
                              <div key={idx} className="border-r border-slate-100 h-full"></div>
                          ))}
                       </div>
                       
                       {/* The Bar */}
                       {/* In a real app, calculate left/width based on wf.startDate and duration */}
                       <div 
                         className={`absolute top-1.5 h-5 rounded shadow-sm opacity-80 ${wf.progress === 100 ? 'bg-emerald-400' : 'bg-indigo-400'} border border-white/20`}
                         style={{
                           left: `${(Math.random() * 60)}%`,
                           width: `${Math.max(10, Math.random() * 30)}%`
                         }}
                       >
                         <span className="text-[10px] text-white px-2 font-medium flex items-center h-full">
                           {wf.progress}%
                         </span>
                       </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};