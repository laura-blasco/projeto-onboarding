import React, { useState, useEffect, useRef } from 'react';
import { SPE } from './types';
import { generateMockData } from './services/mockData';
import { parseDataFromFiles } from './services/excelParser';
import { Dashboard } from './components/Dashboard';
import { Portfolio } from './components/Portfolio';
import { Efficiency } from './components/Efficiency';
import { CalendarView } from './components/Calendar';
import { SPEDetails } from './components/SPEDetails';
import { LayoutDashboard, Briefcase, Timer, Calendar as CalendarIcon, Upload, Bell, Menu, Search, AlertCircle, X, FileSpreadsheet, Check, Folder, Layers, ListTodo } from 'lucide-react';

type View = 'dashboard' | 'portfolio' | 'efficiency' | 'calendar';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [data, setData] = useState<SPE[]>([]);
  const [filteredData, setFilteredData] = useState<SPE[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFiles, setImportFiles] = useState<{ process?: File; track?: File; task?: File }>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Drill-down State
  const [selectedSPE, setSelectedSPE] = useState<SPE | null>(null);
  
  // Refs for hidden inputs
  const processInputRef = useRef<HTMLInputElement>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // ETL & Hybrid Persistence Logic
  useEffect(() => {
    const loadData = () => {
      // 1. Fetch Static Data (Simulating Excel Import)
      const rawData = generateMockData();
      
      // 2. Fetch User Logs from LocalStorage (Persistence)
      const mergedData = mergeUserLogs(rawData);

      setData(mergedData);
      setFilteredData(mergedData);
      setIsLoading(false);
    };

    setTimeout(loadData, 800); 
  }, []);

  const mergeUserLogs = (rawData: SPE[]): SPE[] => {
      const savedLogs = localStorage.getItem('trinus_user_logs');
      const userLogsMap = savedLogs ? JSON.parse(savedLogs) : {};

      return rawData.map(spe => {
        const storedUpdates = userLogsMap[spe.processId] || [];
        return {
          ...spe,
          updates: [...storedUpdates, ...spe.updates].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        };
      });
  }

  // Search Logic
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const filtered = data.filter(spe => 
      spe.name.toLowerCase().includes(lower) || 
      spe.groupName.toLowerCase().includes(lower) ||
      spe.metadata.cnpj.includes(lower)
    );
    setFilteredData(filtered);
  }, [searchTerm, data]);

  const handleUpdateSPE = (updatedSPE: SPE) => {
    // 1. Update State
    const newData = data.map(item => item.id === updatedSPE.id ? updatedSPE : item);
    setData(newData);
    setFilteredData(newData); 
    setSelectedSPE(updatedSPE);

    // 2. Persist User Logs to LocalStorage (Hybrid)
    const savedLogs = localStorage.getItem('trinus_user_logs');
    const userLogsMap = savedLogs ? JSON.parse(savedLogs) : {};
    
    const userOnlyUpdates = updatedSPE.updates.filter(u => u.author === 'Você (Gestor)');
    
    userLogsMap[updatedSPE.processId] = userOnlyUpdates;
    localStorage.setItem('trinus_user_logs', JSON.stringify(userLogsMap));
  };

  const handleFileSelect = (type: 'process' | 'track' | 'task', event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
          const file = event.target.files[0];
          setImportFiles(prev => ({ ...prev, [type]: file }));
          setUploadError(null);
      }
  };

  const handleImportSubmit = async () => {
     if (!importFiles.process || !importFiles.track || !importFiles.task) {
         setUploadError("É necessário selecionar os 3 arquivos para processar a base.");
         return;
     }

     setIsLoading(true);
     setUploadError(null);
     
     try {
         const parsedData = await parseDataFromFiles({
             processFile: importFiles.process,
             trackFile: importFiles.track,
             taskFile: importFiles.task
         });

         const mergedData = mergeUserLogs(parsedData);
         setData(mergedData);
         setFilteredData(mergedData);
         setActiveView('portfolio'); 
         setIsImportModalOpen(false);
         setImportFiles({}); // Reset
         alert(`Importação concluída! ${mergedData.length} processos carregados.`);
     } catch (e: any) {
         console.error(e);
         setUploadError(e.message || "Erro crítico ao processar arquivos.");
     } finally {
         setIsLoading(false);
     }
  };

  const handleViewChange = (view: View) => {
    setActiveView(view);
    setSelectedSPE(null);
  };

  const handleSelectSPE = (spe: SPE) => {
    setSelectedSPE(spe);
  };

  const NavItem: React.FC<{ view: View; icon: React.ReactNode; label: string }> = ({ view, icon, label }) => (
    <button
      onClick={() => handleViewChange(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1
        ${activeView === view && !selectedSPE
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      {icon}
      {sidebarOpen && <span>{label}</span>}
    </button>
  );

  const FileUploadItem = ({ 
    title, 
    desc, 
    file, 
    inputRef, 
    onSelect,
    icon: Icon 
  }: { 
    title: string, 
    desc: string, 
    file?: File, 
    inputRef: React.RefObject<HTMLInputElement>, 
    onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void,
    icon: React.ElementType
  }) => (
      <div 
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer group
           ${file ? 'border-emerald-200 bg-emerald-50' : 'border-dashed border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}
        `}
      >
         <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-slate-200 text-slate-400 group-hover:text-indigo-500'}`}>
            {file ? <Check size={20}/> : <Icon size={20}/>}
         </div>
         <div className="flex-1 min-w-0">
             <h4 className={`text-sm font-bold ${file ? 'text-emerald-800' : 'text-slate-700'}`}>{title}</h4>
             <p className="text-xs text-slate-400 truncate">{file ? file.name : desc}</p>
         </div>
         <input type="file" ref={inputRef} onChange={onSelect} accept=".xlsx, .xls" className="hidden" />
      </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans relative">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-100 px-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">T</div>
               <span>Trinus<span className="text-indigo-600">Mgr</span></span>
            </div>
          ) : (
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">T</div>
          )}
        </div>

        <nav className="flex-1 p-4">
          <p className={`text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider ${!sidebarOpen && 'text-center'}`}>
            {sidebarOpen ? 'Menu Principal' : '...'}
          </p>
          <NavItem view="dashboard" icon={<LayoutDashboard size={20} />} label="Visão Geral" />
          <NavItem view="portfolio" icon={<Briefcase size={20} />} label="Carteira (Cockpit)" />
          <NavItem view="efficiency" icon={<Timer size={20} />} label="Eficiência e SLA" />
          <NavItem view="calendar" icon={<CalendarIcon size={20} />} label="Cronograma" />
        </nav>
        
        <div className="p-4 border-t border-slate-100">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              JD
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-slate-700 truncate">John Doe</p>
                <p className="text-xs text-slate-400 truncate">Gestor</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 capitalize hidden md:block">
              {selectedSPE ? 'Contexto da Operação' : (activeView === 'portfolio' ? 'Gestão de Carteira' : activeView === 'dashboard' ? 'Visão Geral Executiva' : activeView === 'efficiency' ? 'Eficiência e SLA' : 'Linha do Tempo')}
            </h1>
            
            {/* Global Search Bar */}
            {!selectedSPE && (
              <div className="ml-8 relative max-w-md w-full hidden md:block">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Buscar por SPE, Grupo ou CNPJ..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Importar Dados</span>
            </button>
            <div className="w-px h-6 bg-slate-200"></div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto p-6 scroll-smooth bg-slate-50/50">
          {isLoading ? (
            <div className="h-full flex items-center justify-center flex-col gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="text-slate-500 text-sm animate-pulse">Sincronizando Dados...</p>
            </div>
          ) : (
            <div className="max-w-[1600px] mx-auto h-full">
              {selectedSPE ? (
                <SPEDetails 
                  spe={selectedSPE} 
                  onBack={() => setSelectedSPE(null)} 
                  onUpdate={handleUpdateSPE}
                />
              ) : (
                <>
                  {activeView === 'dashboard' && <Dashboard data={filteredData} onSelectSPE={handleSelectSPE} />}
                  {activeView === 'portfolio' && <Portfolio data={filteredData} onSelectSPE={handleSelectSPE} />}
                  {activeView === 'efficiency' && <Efficiency data={filteredData} />}
                  {activeView === 'calendar' && <CalendarView data={filteredData} />}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                       <FileSpreadsheet className="text-emerald-600" size={20}/>
                       Importar Dados (Multibase)
                   </h3>
                   <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                       <X size={20}/>
                   </button>
               </div>
               
               <div className="p-6 space-y-6">
                   {/* Instructions */}
                   <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800">
                       <p className="font-semibold mb-2">Instruções de Importação:</p>
                       <p>Selecione os 3 arquivos Excel correspondentes às bases de dados para realizar a unificação.</p>
                   </div>

                   {/* 3-File Upload Area */}
                   <div className="space-y-3">
                       <FileUploadItem 
                          title="Base de Processos (Pai)"
                          desc="processos_analitico.xlsx"
                          file={importFiles.process}
                          inputRef={processInputRef}
                          onSelect={(e) => handleFileSelect('process', e)}
                          icon={Folder}
                       />
                       <FileUploadItem 
                          title="Base de Esteiras (Agrupador)"
                          desc="esteiras_analitico.xlsx"
                          file={importFiles.track}
                          inputRef={trackInputRef}
                          onSelect={(e) => handleFileSelect('track', e)}
                          icon={Layers}
                       />
                       <FileUploadItem 
                          title="Base de Tarefas (Fato)"
                          desc="tarefas_fato.xlsx"
                          file={importFiles.task}
                          inputRef={taskInputRef}
                          onSelect={(e) => handleFileSelect('task', e)}
                          icon={ListTodo}
                       />
                   </div>

                   {/* Error Display */}
                   {uploadError && (
                       <div className="flex items-start gap-3 bg-rose-50 text-rose-700 p-3 rounded-lg text-sm border border-rose-100">
                           <AlertCircle className="shrink-0 mt-0.5" size={16}/>
                           <div>
                               <p className="font-bold">Atenção</p>
                               <p>{uploadError}</p>
                           </div>
                       </div>
                   )}
               </div>

               <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                   <button 
                     onClick={() => setIsImportModalOpen(false)}
                     className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors"
                   >
                       Cancelar
                   </button>
                   <button 
                     onClick={handleImportSubmit}
                     className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                     disabled={!importFiles.process || !importFiles.track || !importFiles.task}
                   >
                       Processar Arquivos
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;