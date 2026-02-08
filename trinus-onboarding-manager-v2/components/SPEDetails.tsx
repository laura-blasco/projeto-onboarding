import React, { useState } from 'react';
import { SPE, UpdateLog, Status, Task } from '../types';
import { getStatusText, translateStatus } from '../services/engine';
import { ArrowLeft, Send, CheckCircle, User, MessageSquarePlus, Save, X, ChevronDown, ChevronRight, AlertCircle, FileText, Check, Clock, AlertTriangle, Slash } from 'lucide-react';

interface SPEDetailsProps {
  spe: SPE;
  onBack: () => void;
  onUpdate: (updatedSPE: SPE) => void;
}

export const SPEDetails: React.FC<SPEDetailsProps> = ({ spe, onBack, onUpdate }) => {
  // General SPE Updates state
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<UpdateLog['type']>('GENERAL');

  // Task Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskComment, setTaskComment] = useState('');
  const [selectedCause, setSelectedCause] = useState('');
  
  // Status Menu State
  const [statusMenuTaskId, setStatusMenuTaskId] = useState<string | null>(null);
  
  // Accordion State
  const [expandedWorkflows, setExpandedWorkflows] = useState<Record<string, boolean>>(
      spe.workflows.reduce((acc, wf) => ({...acc, [wf.id]: wf.progress < 100}), {})
  );

  const causeTags = ['Documentação', 'Acesso/Sistema', 'Erro Técnico', 'Aguardando Cliente'];

  // --- Logic ---
  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const log: UpdateLog = {
      id: `log-${Date.now()}`,
      date: new Date(),
      author: 'Você (Gestor)', 
      type: commentType,
      content: newComment
    };

    const updatedSPE = {
      ...spe,
      updates: [log, ...spe.updates],
      lastActivityDate: new Date()
    };
    
    onUpdate(updatedSPE);
    setNewComment('');
  };

  const toggleWorkflow = (id: string) => {
      setExpandedWorkflows(prev => ({...prev, [id]: !prev[id]}));
  }

  const handleEditTask = (task: Task) => {
    if (editingTaskId === task.id) {
        setEditingTaskId(null);
        return;
    }
    setEditingTaskId(task.id);
    setTaskComment(task.comments || '');
    const foundTag = causeTags.find(tag => (task.comments || '').includes(`[${tag}]`));
    setSelectedCause(foundTag || '');
    // Close status menu if open
    setStatusMenuTaskId(null);
  };

  const saveTaskUpdate = (workflowId: string, taskId: string) => {
     let finalComment = taskComment;
     causeTags.forEach(tag => {
        finalComment = finalComment.replace(`[${tag}]`, '').trim();
     });
     if (selectedCause) {
         finalComment = `[${selectedCause}] ${finalComment}`;
     }

     const updatedWorkflows = spe.workflows.map(wf => {
         if (wf.id !== workflowId) return wf;
         return {
             ...wf,
             tasks: wf.tasks.map(t => {
                 if (t.id !== taskId) return t;
                 return { ...t, comments: finalComment };
             })
         };
     });

     onUpdate({
         ...spe,
         workflows: updatedWorkflows
     });
     setEditingTaskId(null);
  };

  const handleStatusChange = (workflowId: string, taskId: string, newStatus: Status) => {
    const updatedWorkflows = spe.workflows.map(wf => {
      if (wf.id !== workflowId) return wf;

      // 1. Update the specific task
      const updatedTasks = wf.tasks.map(t => {
        if (t.id !== taskId) return t;
        
        // Logic: if completing, set date. If un-completing, clear date.
        const completedDate = newStatus === Status.COMPLETED ? new Date() : undefined;
        
        return { 
          ...t, 
          status: newStatus,
          completedDate: completedDate
        };
      });

      // 2. Recalculate Progress for this workflow
      const completedCount = updatedTasks.filter(t => t.status === Status.COMPLETED).length;
      const progress = updatedTasks.length > 0 
        ? Math.round((completedCount / updatedTasks.length) * 100) 
        : 0;

      return {
        ...wf,
        tasks: updatedTasks,
        progress: progress
      };
    });

    onUpdate({
      ...spe,
      workflows: updatedWorkflows
    });
    setStatusMenuTaskId(null);
  };

  const translateLogType = (type: string) => {
      switch(type) {
          case 'GENERAL': return 'GERAL';
          case 'BLOCKER': return 'BLOQUEIO';
          case 'PROGRESS': return 'PROGRESSO';
          default: return type;
      }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-fade-in relative">
       {/* Global Click Handler to close menus */}
       {statusMenuTaskId && (
         <div className="fixed inset-0 z-40" onClick={() => setStatusMenuTaskId(null)}></div>
       )}

      {/* Header / Context */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
             <h2 className="text-xl font-bold text-slate-800">{spe.name}</h2>
             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusText(spe.overallStatus)}`}>
               {translateStatus(spe.overallStatus)}
             </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
             <span className="font-semibold text-slate-700">{spe.groupName}</span>
             <span>•</span>
             <span className="font-mono">{spe.metadata.cnpj}</span>
             <span>•</span>
             <span>ProcID: {spe.processId}</span>
          </div>
        </div>
        <div className="text-right hidden md:block">
           <div className="text-[10px] text-slate-400 uppercase">Data Início</div>
           <div className="text-sm font-medium text-slate-700">{spe.startDate.toLocaleDateString()}</div>
        </div>
      </div>

      {/* Split View Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">
        
        {/* === LEFT COLUMN: THE JOURNAL (Daily Context) === */}
        <div className="lg:w-1/3 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                 <FileText size={16} /> Diário de Bordo
              </h3>
              <span className="text-xs text-slate-400">{spe.updates.length} registros</span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 flex flex-col">
              {/* Input Area */}
              <div className="mb-6">
                  <div className="flex gap-2 mb-2">
                      {(['GENERAL', 'PROGRESS', 'BLOCKER'] as const).map(t => (
                        <button key={t} onClick={() => setCommentType(t)} className={`flex-1 py-1 text-[10px] font-bold rounded uppercase transition-colors ${commentType === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{translateLogType(t)}</button>
                      ))}
                  </div>
                  <div className="relative">
                    <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pb-10 text-sm focus:ring-2 focus:ring-indigo-500 resize-none min-h-[100px]"
                        placeholder="Registro diário: Reunião, Bloqueio ou Nota..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                    ></textarea>
                    <button 
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <Send size={14} />
                    </button>
                  </div>
              </div>

              {/* Timeline Feed */}
              <div className="space-y-6 pl-2">
                 {spe.updates.map((log, idx) => (
                    <div key={log.id} className="relative pl-6 border-l-2 border-slate-100">
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${log.type === 'BLOCKER' ? 'bg-rose-500' : (log.type === 'PROGRESS' ? 'bg-emerald-500' : 'bg-indigo-400')}`}></div>
                        <div className="mb-1 flex justify-between items-start">
                           <span className={`text-[9px] font-bold px-1 py-px rounded uppercase ${log.type === 'BLOCKER' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{translateLogType(log.type)}</span>
                           <span className="text-[10px] text-slate-400">{log.date.toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100/50">
                           {log.content}
                        </p>
                        <div className="mt-1 text-[10px] text-slate-400 font-medium">{log.author}</div>
                    </div>
                 ))}
                 
                 {/* Milestones in Feed */}
                 {spe.milestones.filter(m => m.status === 'COMPLETED').map((ms, idx) => (
                    <div key={`ms-${idx}`} className="relative pl-6 border-l-2 border-emerald-100">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white bg-emerald-500 shadow-sm flex items-center justify-center">
                            <CheckCircle size={10} className="text-white"/>
                        </div>
                        <div className="text-xs text-emerald-800 font-bold">Marco Atingido: {ms.label}</div>
                        <div className="text-[10px] text-emerald-600">{ms.date?.toLocaleDateString()}</div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* === RIGHT COLUMN: THE SCHEDULE (Execution Context) === */}
        <div className="lg:w-2/3 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Cronograma de Execução</h3>
               <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500"><div className="w-2 h-2 bg-rose-400 rounded-full"></div> Atrasado</span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500"><div className="w-2 h-2 bg-emerald-400 rounded-full"></div> Concluído</span>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {spe.workflows.map(wf => {
                 const isExpanded = expandedWorkflows[wf.id];
                 const delayedTasks = wf.tasks.filter(t => t.status === Status.DELAYED).length;

                 return (
                 <div key={wf.id} className="border border-slate-200 rounded-lg overflow-hidden transition-all">
                    {/* Accordion Header */}
                    <button 
                        onClick={() => toggleWorkflow(wf.id)}
                        className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'bg-white hover:bg-slate-50'}`}
                    >
                       <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                          <div className="text-left">
                             <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                {wf.phase}
                                {delayedTasks > 0 && <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 rounded-full font-bold flex items-center gap-1"><AlertCircle size={10}/> {delayedTasks} Atrasados</span>}
                             </h4>
                             <div className="h-1 w-24 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{width: `${wf.progress}%`}}></div>
                             </div>
                          </div>
                       </div>
                       <span className="text-xs text-slate-400 font-mono">{wf.progress}%</span>
                    </button>

                    {/* Task List */}
                    {isExpanded && (
                        <div className="bg-white divide-y divide-slate-100">
                          {wf.tasks.map(task => (
                            <div key={task.id} className={`flex flex-col gap-2 px-4 py-3 transition-colors border-l-4 ${task.status === Status.DELAYED ? 'border-l-rose-400 bg-rose-50/10' : (task.status === Status.COMPLETED ? 'border-l-emerald-400 bg-slate-50/50' : 'border-l-transparent hover:bg-slate-50')}`}>
                              <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                                <div className="flex items-start gap-3 flex-1 relative">
                                   {/* Status Button with Popover */}
                                   <div className="relative z-50">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id);
                                        }}
                                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm
                                          ${task.status === Status.COMPLETED ? 'bg-emerald-500 border-emerald-500 text-white' : 
                                            (task.status === Status.DELAYED ? 'bg-rose-100 border-rose-300 text-rose-600' : 
                                            (task.status === Status.BLOCKED ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'))}
                                        `}
                                      >
                                         {task.status === Status.COMPLETED && <CheckCircle size={12} />}
                                         {task.status === Status.DELAYED && <AlertCircle size={12} />}
                                         {task.status === Status.BLOCKED && <Slash size={10} />}
                                      </button>
                                      
                                      {/* Status Menu Popover */}
                                      {statusMenuTaskId === task.id && (
                                        <div className="absolute top-6 left-0 w-36 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden animate-fade-in z-50">
                                            <button onClick={() => handleStatusChange(wf.id, task.id, Status.COMPLETED)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-emerald-50 text-emerald-700">
                                                <Check size={12}/> Concluir
                                            </button>
                                            <button onClick={() => handleStatusChange(wf.id, task.id, Status.ON_TRACK)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700">
                                                <Clock size={12}/> Em Dia
                                            </button>
                                            <button onClick={() => handleStatusChange(wf.id, task.id, Status.DELAYED)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-rose-50 text-rose-700">
                                                <AlertTriangle size={12}/> Atrasar
                                            </button>
                                            <button onClick={() => handleStatusChange(wf.id, task.id, Status.BLOCKED)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-100 text-slate-800">
                                                <Slash size={12}/> Bloquear
                                            </button>
                                        </div>
                                      )}
                                   </div>

                                   <div className="flex-1">
                                     <p className={`text-sm font-medium leading-tight ${task.status === Status.COMPLETED ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.name}</p>
                                     <div className="flex items-center gap-3 mt-1.5">
                                       <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-100 px-1.5 rounded">
                                         <User size={10} /> {task.assignee}
                                       </span>
                                       <span className={`text-[10px] px-1.5 rounded border ${task.responsibility === 'TRINUS' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                                          {task.responsibility === 'TRINUS' ? 'Trinus' : (task.responsibility === 'CLIENT' ? 'Cliente' : 'Terceiro')}
                                       </span>
                                     </div>
                                   </div>
                                </div>
                                
                                {/* Right Side Meta */}
                                <div className="flex items-center gap-4 text-right pl-7 md:pl-0">
                                  <div className="flex flex-col items-end min-w-[70px]">
                                    <p className={`text-xs font-medium ${task.status === Status.DELAYED ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                                        {task.dueDate.toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => handleEditTask(task)}
                                    className={`p-1.5 rounded transition-colors ${editingTaskId === task.id ? 'bg-indigo-200 text-indigo-800' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                                  >
                                    {editingTaskId === task.id ? <X size={14} /> : <MessageSquarePlus size={14} />}
                                  </button>
                                </div>
                              </div>
                              
                              {/* Task Comment View */}
                              {task.comments && editingTaskId !== task.id && (
                                  <div className="ml-7 text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 italic flex items-start gap-1">
                                     <span className="not-italic">💬</span> {task.comments}
                                  </div>
                              )}

                              {/* Inline Edit Form */}
                              {editingTaskId === task.id && (
                                <div className="ml-7 mt-1 pt-2 border-t border-indigo-100/50 animate-fade-in bg-white p-2 rounded-lg shadow-sm border border-indigo-100">
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {causeTags.map(tag => (
                                            <button key={tag} onClick={() => setSelectedCause(selectedCause === tag ? '' : tag)} className={`text-[9px] px-2 py-0.5 rounded-full border font-medium transition-all ${selectedCause === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{tag}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" value={taskComment} onChange={(e) => setTaskComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTaskUpdate(wf.id, task.id)} className="flex-1 text-xs p-1.5 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                                        <button onClick={() => saveTaskUpdate(wf.id, task.id)} className="bg-indigo-600 text-white px-2 rounded hover:bg-indigo-700"><Save size={12} /></button>
                                    </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                    )}
                 </div>
                 )
               })}
             </div>
        </div>
      </div>
    </div>
  );
};