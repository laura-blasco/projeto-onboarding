/**
 * TRINUS ONBOARDING MANAGER V2.0 (RC1)
 * Engenharia: Fusão da Lógica de Datas (App 1) com Interface Hierárquica (App 2)
 */

// ============================================================
// 1. ENGINE DE DATAS & SLA (Core Business Logic)
// ============================================================
const WorkingHoursEngine = {
    // Feriados Nacionais 2024-2026 (Hardcoded para performance)
    HOLIDAYS: [
        '2024-01-01', '2024-02-12', '2024-02-13', '2024-03-29', '2024-04-21', '2024-05-01', '2024-05-30', '2024-09-07', '2024-10-12', '2024-11-02', '2024-11-15', '2024-11-20', '2024-12-25',
        '2025-01-01', '2025-03-03', '2025-03-04', '2025-04-18', '2025-04-21', '2025-05-01', '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20', '2025-12-25',
        '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'
    ],

    isWorkingDay(date) {
        const day = date.getDay();
        const dateString = date.toISOString().split('T')[0];
        return day !== 0 && day !== 6 && !this.HOLIDAYS.includes(dateString);
    },

    // Soma dias úteis a uma data (SLA Calculator)
    addWorkingDays(startDateStr, days) {
        if (!startDateStr || !days) return startDateStr;
        let date = new Date(startDateStr + 'T00:00:00');
        let added = 0;
        while (added < days) {
            date.setDate(date.getDate() + 1);
            if (this.isWorkingDay(date)) added++;
        }
        return date.toISOString().split('T')[0];
    },

    // Formatação BR
    formatDate(isoDate) {
        if (!isoDate) return '-';
        const [y, m, d] = isoDate.split('-');
        return `${d}/${m}/${y}`;
    },

    // Calcula dias úteis entre duas datas
    calcBusinessDays(startDateStr, endDateStr) {
        if (!startDateStr || !endDateStr) return null;
        let start = new Date(startDateStr + 'T00:00:00');
        let end = new Date(endDateStr + 'T00:00:00');
        if (start > end) return 0;

        let count = 0;
        let current = new Date(start);
        while (current <= end) {
            if (this.isWorkingDay(current)) count++;
            current.setDate(current.getDate() + 1);
        }
        return count;
    },

    // Classifica causa raiz com base no comentário
    classifyCausaRaiz(comentario) {
        if (!comentario) return 'Não Aplicável';
        const lower = comentario.toLowerCase();
        if (lower.includes('doc') || lower.includes('comprovante') || lower.includes('certid')) return 'Documentação';
        if (lower.includes('cliente') || lower.includes('assinatur')) return 'Cliente';
        if (lower.includes('sistem') || lower.includes('erp') || lower.includes('técnic')) return 'Técnico';
        if (lower.includes('aprovação') || lower.includes('jurídic')) return 'Aprovação';
        return 'Outro';
    },

    // Determina bucket de aging para tarefas abertas
    getAgingBucket(criacaoDateStr) {
        if (!criacaoDateStr) return null;
        const today = new Date();
        const criacao = new Date(criacaoDateStr + 'T00:00:00');
        const diffDays = Math.floor((today - criacao) / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) return '0-7 dias';
        if (diffDays <= 15) return '8-15 dias';
        if (diffDays <= 30) return '16-30 dias';
        return '30+ dias';
    }
};

// ============================================================
// 2. STATE MANAGEMENT (Single Source of Truth)
// ============================================================
const App = {
    state: {
        currentView: 'carteira', // Default to portfolio view
        routeParams: {}, // Parâmetros de rota (ex: SPE para drill-down)
        filterClient: '',
        filterService: '', // Service filter for analytical queries
        data: [], // Dados normalizados da hierarquia
        annotations: JSON.parse(localStorage.getItem('trinus_annotations')) || {},
        events: JSON.parse(localStorage.getItem('trinus_events')) || {},
        journals: JSON.parse(localStorage.getItem('trinus_journals')) || {}, // SPE-keyed journal entries
        currentMonth: new Date(), // Navegação do calendário
        expandedItems: {}, // Controle de UI (Accordions)
        pendingData: null, // Dados pendentes de importação
        activeDate: null, // Data ativa para modais
        chartInstances: {}, // Instâncias de Chart.js para destruição
        activeSpeName: null, // SPE selecionada na visão Operação
        activeTab: 'diario' // Aba ativa na visão Operação (diario, cronograma, cadastro)
    },

    // Mapa de títulos para breadcrumb
    viewTitles: {
        'carteira': 'Carteira',
        'operacao': 'Operação',
        'overview': 'Visão Geral',
        'esteiras': 'Esteiras',
        'sla': 'SLA & Tempo',
        'pendencias': 'Pendências',
        'company': 'Empresa',
        'calendario': 'Calendário',
        'daily': 'Daily Operacional'
    },

    // Definição dos Marcos de Jornada (TtV)
    milestoneConfig: [
        { key: 'data_inicio_contrato', label: 'Assinatura', icon: 'fa-file-signature' },
        { key: 'data_handover_comercial', label: 'Handover', icon: 'fa-handshake' },
        { key: 'data_kick_off_cliente', label: 'Kick-off', icon: 'fa-rocket' },
        { key: 'data_apresentacao_viabilidade', label: 'Viabilidade', icon: 'fa-check-circle' },
        { key: 'data_inicio_financeira', label: 'Financeiro', icon: 'fa-dollar-sign' },
        { key: 'data_inicio_carteira', label: 'Carteira', icon: 'fa-briefcase' }
    ],

    // Dados de Fallback (Demo) - Modelo Granular
    demoData: [
        {
            id: "1",
            razao_social_cliente: "DEMO CONSTRUTORA LTDA",
            razao_social_da_spe: "SPE Residencial Jardins",
            cnpj_da_spe: "12.345.678/0001-90",
            erp: "SAP",
            codigo_uau: 1001,
            fase_da_spe: "Implantação",
            servicos_contratados: "Onboarding Completo",
            sla_dias_uteis_padrao: 5,
            process_id: "PROC-001",
            task_id: "TASK-001",
            nome_tarefa: "Análise de Viabilidade Técnica",
            classificacao_tarefa: "Técnica",
            responsabilidade: "Equipe Engenharia",
            esteira: "Viabilidade",
            status_real: "Concluída",
            status_esteira_detalhado: "Aprovado",
            comentario_resolucao_pendencia: null,
            criacao_tarefa: "2026-01-25",
            conclusao_tarefa: "2026-02-01",
            data_prazo_sla: "2026-02-03",
            data_inicio_contrato: "2026-01-20",
            data_kick_off_cliente: "2026-01-22",
            data_inicio_financeira: null,
            data_apresentacao_viabilidade: "2026-02-01",
            data_inicio_carteira: null
        },
        {
            id: "2",
            razao_social_cliente: "DEMO CONSTRUTORA LTDA",
            razao_social_da_spe: "SPE Residencial Jardins",
            cnpj_da_spe: "12.345.678/0001-90",
            erp: "SAP",
            codigo_uau: 1001,
            fase_da_spe: "Implantação",
            servicos_contratados: "Onboarding Completo",
            sla_dias_uteis_padrao: 10,
            process_id: "PROC-001",
            task_id: "TASK-002",
            nome_tarefa: "Elaboração de Minuta Contratual",
            classificacao_tarefa: "Jurídica",
            responsabilidade: "Equipe Jurídico",
            esteira: "Jurídico",
            status_real: "Em Andamento",
            status_esteira_detalhado: "Aguardando Revisão",
            comentario_resolucao_pendencia: "Pendente assinatura do cliente",
            criacao_tarefa: "2026-02-01",
            conclusao_tarefa: null,
            data_prazo_sla: "2026-02-14",
            data_inicio_contrato: "2026-01-20",
            data_kick_off_cliente: "2026-01-22",
            data_inicio_financeira: null,
            data_apresentacao_viabilidade: "2026-02-01",
            data_inicio_carteira: null
        },
        {
            id: "3",
            razao_social_cliente: "DEMO CONSTRUTORA LTDA",
            razao_social_da_spe: "SPE Comercial Centro",
            cnpj_da_spe: "12.345.678/0002-71",
            erp: "SAP",
            codigo_uau: 1002,
            fase_da_spe: "Pré-Operação",
            servicos_contratados: "Financeiro + Fiscal",
            sla_dias_uteis_padrao: 15,
            process_id: "PROC-002",
            task_id: "TASK-003",
            nome_tarefa: "Setup de Contas Bancárias",
            classificacao_tarefa: "Financeira",
            responsabilidade: "Equipe Financeiro",
            esteira: "Financeiro",
            status_real: "Pendente",
            status_esteira_detalhado: "Aguardando Documentação",
            comentario_resolucao_pendencia: "Cliente não enviou comprovantes",
            criacao_tarefa: "2026-02-05",
            conclusao_tarefa: null,
            data_prazo_sla: "2026-02-26",
            data_inicio_contrato: "2026-02-01",
            data_kick_off_cliente: "2026-02-03",
            data_inicio_financeira: "2026-02-05",
            data_apresentacao_viabilidade: null,
            data_inicio_carteira: null
        },
        {
            id: "4",
            razao_social_cliente: "BETA INCORPORADORA SA",
            razao_social_da_spe: "SPE Loteamento Jardins",
            cnpj_da_spe: "98.765.432/0001-10",
            erp: "TOTVS",
            codigo_uau: 2001,
            fase_da_spe: "Implantação",
            servicos_contratados: "Onboarding Completo",
            sla_dias_uteis_padrao: 20,
            process_id: "PROC-003",
            task_id: "TASK-004",
            nome_tarefa: "Projeto Arquitetônico",
            classificacao_tarefa: "Técnica",
            responsabilidade: "Equipe Engenharia",
            esteira: "Engenharia",
            status_real: "Em Andamento",
            status_esteira_detalhado: "Em Desenvolvimento",
            comentario_resolucao_pendencia: null,
            criacao_tarefa: "2026-02-01",
            conclusao_tarefa: null,
            data_prazo_sla: "2026-03-03",
            data_inicio_contrato: "2026-01-15",
            data_kick_off_cliente: "2026-01-20",
            data_inicio_financeira: null,
            data_apresentacao_viabilidade: "2026-01-25",
            data_inicio_carteira: "2026-02-01"
        }
    ],

    init() {
        console.log('🚀 Trinus Onboarding V2 Initialized');
        this.loadData();
        this.renderSidebar();
        this.render();
        if (window.lucide) lucide.createIcons();
    },

    loadData() {
        const stored = localStorage.getItem('trinus_data');
        const rawData = stored ? JSON.parse(stored) : this.demoData;
        this.state.data = this.enrichData(rawData);
        this.populateFilters();
    },

    saveData() {
        localStorage.setItem('trinus_data', JSON.stringify(this.state.data));
        localStorage.setItem('trinus_annotations', JSON.stringify(this.state.annotations));
        localStorage.setItem('trinus_events', JSON.stringify(this.state.events));
        localStorage.setItem('trinus_journals', JSON.stringify(this.state.journals));
        this.render(); // Re-render reativo
    },

    // ============================================================
    // 2.1. MILESTONE & STATUS HELPERS (Hybrid Architecture)
    // ============================================================

    // Obtém status dos marcos de jornada para uma SPE
    getMilestones(speData) {
        if (!speData || speData.length === 0) return [];
        const today = new Date().toISOString().split('T')[0];
        const spe = speData[0]; // Usar primeira tarefa para dados da SPE
        const services = spe.servicos_contratados || [];

        // Filtrar marcos aplicáveis (Regra: Carteira apenas se contratado)
        const applicableConfig = this.milestoneConfig.filter(m => {
            if (m.key === 'data_inicio_carteira') {
                const hasService = services.some(s =>
                    s.toLowerCase().includes('carteira') ||
                    s.toLowerCase().includes('comercial') ||
                    s.toLowerCase().includes('pós-venda')
                );
                return hasService || spe.data_inicio_carteira;
            }
            return true;
        });

        return applicableConfig.map((m, index) => {
            const dateValue = spe[m.key];
            let status = 'pending'; // Padrão: pendente

            if (dateValue) {
                // Data existe - verificar se já passou
                status = dateValue <= today ? 'done' : 'pending';
            } else {
                // Data não existe - verificar se deveria existir (SLA estourado)
                if (index > 0) {
                    const prevMilestone = applicableConfig[index - 1];
                    const prevDate = spe[prevMilestone.key];
                    if (prevDate && prevDate <= today) {
                        const expectedDate = WorkingHoursEngine.addWorkingDays(prevDate, 15);
                        if (expectedDate && today > expectedDate) {
                            status = 'delayed';
                        }
                    }
                }
            }

            return {
                ...m,
                date: dateValue,
                status: status
            };
        });
    },


    // Calcula status de saúde da SPE baseado nas tarefas
    getSpeStatus(speData) {
        if (!speData || speData.length === 0) return { status: 'unknown', label: 'Sem Dados', color: 'gray' };

        // Use status_global_processo as the primary status driver
        const globalStatus = (speData[0]?.status_global_processo || '').toLowerCase();
        const pendingCount = speData.filter(t => !t.is_done).length;

        // Map status_global_processo to internal status
        if (globalStatus.includes('conclu') || globalStatus.includes('finaliz')) {
            return { status: 'healthy', label: 'Concluído', color: 'green', pendingCount: 0 };
        }
        if (globalStatus.includes('bloq') || globalStatus.includes('parado') || globalStatus.includes('suspen')) {
            return { status: 'risk', label: 'Bloqueado', color: 'red', pendingCount };
        }
        if (globalStatus.includes('risco') || globalStatus.includes('atras') || globalStatus.includes('atraso')) {
            return { status: 'attention', label: 'Em Risco', color: 'amber', pendingCount };
        }
        if (globalStatus.includes('andamento') || globalStatus.includes('progresso') || globalStatus.includes('ativo')) {
            return { status: 'ok', label: 'Em Andamento', color: 'teal', pendingCount };
        }

        // Fallback: derive from task-level data
        const hasBlocked = speData.some(t =>
            (t.status_real || '').toLowerCase().includes('bloqueada') ||
            (t.status_real || '').toLowerCase().includes('blocked')
        );
        const hasDelayed = speData.some(t => t.is_delayed);
        const allDone = speData.every(t => t.is_done);

        if (hasBlocked) return { status: 'risk', label: 'Bloqueado', color: 'red', pendingCount };
        if (hasDelayed) return { status: 'attention', label: 'Em Risco', color: 'amber', pendingCount };
        if (allDone) return { status: 'healthy', label: 'Concluído', color: 'green', pendingCount: 0 };
        return { status: 'ok', label: 'Em Andamento', color: 'teal', pendingCount };
    },

    // Calcula dias desde última atividade (journal entry)
    getLastActivity(speName) {
        const entries = this.state.journals[speName] || [];
        if (entries.length === 0) return null;

        const lastEntry = entries[entries.length - 1];
        const lastDate = new Date(lastEntry.date);
        const today = new Date();
        const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    // Salva entrada de journal para uma SPE
    saveJournalEntry(speName, entry) {
        if (!this.state.journals[speName]) {
            this.state.journals[speName] = [];
        }
        this.state.journals[speName].push({
            ...entry,
            id: Date.now(),
            date: entry.date || new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('trinus_journals', JSON.stringify(this.state.journals));
        this.render();
    },

    // Remove entrada de journal
    deleteJournalEntry(speName, entryId) {
        if (this.state.journals[speName]) {
            this.state.journals[speName] = this.state.journals[speName].filter(e => e.id !== entryId);
            localStorage.setItem('trinus_journals', JSON.stringify(this.state.journals));
            this.render();
        }
    },

    // Agrupa dados por Cliente -> SPE
    groupByClientAndSpe() {
        const data = this.getFilteredData();
        const grouped = {};

        data.forEach(task => {
            const clientName = task.razao_social_cliente || 'Cliente Desconhecido';
            const speName = task.razao_social_da_spe || 'SPE Desconhecida';

            if (!grouped[clientName]) {
                grouped[clientName] = { name: clientName, spes: {} };
            }
            if (!grouped[clientName].spes[speName]) {
                grouped[clientName].spes[speName] = {
                    name: speName,
                    cnpj: task.cnpj_da_spe,
                    fase: task.fase_da_spe,
                    erp: task.erp,
                    codigo_uau: task.codigo_uau,
                    servicos: task.servicos_contratados,
                    tasks: []
                };
            }
            grouped[clientName].spes[speName].tasks.push(task);
        });

        // Converter para array e calcular métricas
        return Object.values(grouped).map(client => ({
            ...client,
            spes: Object.values(client.spes).map(spe => ({
                ...spe,
                milestones: this.getMilestones(spe.tasks),
                healthStatus: this.getSpeStatus(spe.tasks),
                lastActivity: this.getLastActivity(spe.name)
            }))
        }));
    },

    // ============================================================
    // 3. RENDERIZAÇÃO (Router de Views)
    // ============================================================

    render() {
        this.renderStats();
        this.destroyCharts(); // Limpa gráficos anteriores
        const container = document.getElementById('app-content');
        container.innerHTML = '';

        // Router de Views
        switch (this.state.currentView) {
            case 'carteira':
                this.renderCarteira(container);
                break;
            case 'operacao':
                this.renderOperacao(container);
                break;
            case 'overview':
                this.renderOverview(container);
                break;
            case 'esteiras':
                this.renderEsteiras(container);
                break;
            case 'sla':
                this.renderSLA(container);
                break;
            case 'pendencias':
                this.renderPendencias(container);
                break;
            case 'company':
                this.renderCompanyDrilldown(container);
                break;
            case 'calendario':
                this.renderCalendar(container);
                break;
            case 'daily':
                this.renderDaily(container);
                break;
            default:
                this.renderCarteira(container);
        }

        // Update Sidebar Active State
        document.querySelectorAll('.sidebar-menu-item').forEach(el => el.classList.remove('active'));
        const activeMenu = document.getElementById(`menu-${this.state.currentView}`);
        if (activeMenu) activeMenu.classList.add('active');

        // Update Breadcrumb
        document.getElementById('breadcrumb-active').textContent = this.viewTitles[this.state.currentView] || 'Dashboard';

        if (window.lucide) lucide.createIcons();
    },

    // Destroi instâncias de Chart.js antes de recriar
    destroyCharts() {
        Object.values(this.state.chartInstances).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        this.state.chartInstances = {};
    },

    // Router: Navegação com parâmetros
    router: {
        go(view, params = {}) {
            App.state.currentView = view;
            App.state.routeParams = params;
            App.render();
        }
    },

    // ============================================================
    // 3.1. VISÃO CARTEIRA (Portfolio View - Executive)
    // ============================================================

    renderCarteira(container) {
        const grouped = this.groupByClientAndSpe();

        if (grouped.length === 0) {
            container.innerHTML = `<div class="text-center p-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <i class="fa-solid fa-inbox text-4xl mb-4"></i><br>Nenhum dado encontrado.<br>Importe uma planilha ou limpe os filtros.
            </div>`;
            return;
        }

        let html = '<div class="fade-in space-y-4">';

        grouped.forEach(client => {
            const isExpanded = this.state.expandedItems[client.name] !== false; // Default expanded
            const clientKey = this.escapeAttr(client.name);

            html += `
                <div class="portfolio-client">
                    <div class="portfolio-client-header" onclick="App.toggleAccordion('${clientKey}')">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-teal-100 rounded-lg text-teal-600">
                                <i class="fa-solid fa-building text-lg"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-800">${this.escapeHtml(client.name)}</h3>
                                <span class="text-xs text-slate-500">${client.spes.length} SPE${client.spes.length > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-slate-400"></i>
                    </div>
                    <div class="portfolio-spes ${isExpanded ? 'expanded' : ''}">
                        ${client.spes.map(spe => this.renderSpeRow(spe)).join('')}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    renderSpeRow(spe) {
        const statusClass = {
            'risk': 'status-badge--delayed',
            'attention': 'status-badge--at-risk',
            'healthy': 'status-badge--completed',
            'ok': 'status-badge--on-track',
            'unknown': 'status-badge--on-track'
        }[spe.healthStatus?.status || 'unknown'];

        const speKey = this.escapeAttr(spe.name);

        // Render services as badges
        const servicos = spe.servicos_contratados || [];
        const serviceBadgesHtml = Array.isArray(servicos) && servicos.length > 0
            ? `<div class="service-badges mt-1">
                ${servicos.slice(0, 3).map((s, i) =>
                `<span class="service-badge ${i > 0 ? 'service-badge--alt' : ''}">${this.escapeHtml(s)}</span>`
            ).join('')}
                ${servicos.length > 3 ? `<span class="service-badge service-badge--alt">+${servicos.length - 3}</span>` : ''}
               </div>`
            : '';

        return `
            <div class="portfolio-spe-row" onclick="App.openSpeDetail('${speKey}')">
                <div class="spe-info">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${spe.healthStatus?.status === 'risk' ? 'bg-rose-500' : spe.healthStatus?.status === 'attention' ? 'bg-amber-500' : 'bg-emerald-500'}"></div>
                        <div class="spe-name">${this.escapeHtml(spe.name)}</div>
                    </div>
                    <div class="spe-meta">
                        ${spe.cnpj ? `<span class="font-mono text-xs bg-slate-100 px-1 rounded">${spe.cnpj}</span>` : ''}
                        ${spe.fase ? `<span class="spe-fase">${spe.fase}</span>` : ''}
                    </div>
                    ${serviceBadgesHtml}
                </div>
                
                <!-- V2 TtV Journey Bar -->
                <div class="ttv-journey">
                    <div class="ttv-journey__line"></div>
                    ${(spe.milestones || []).map(m => {
            const dotClass = m.status === 'done' ? 'ttv-journey__dot--completed' :
                m.status === 'delayed' ? 'ttv-journey__dot--delayed' : 'ttv-journey__dot--pending';
            const labelClass = m.status === 'done' ? 'ttv-journey__label--completed' : '';
            return `
                            <div class="ttv-journey__milestone" title="${m.label}: ${m.date || 'Pendente'}">
                                <div class="ttv-journey__dot ${dotClass}"></div>
                                <span class="ttv-journey__label ${labelClass}">${m.label}</span>
                            </div>
                        `;
        }).join('')}
                </div>
                
                <div class="spe-status">
                    <span class="status-badge ${statusClass}">${spe.healthStatus?.label || 'Saudável'}</span>
                    ${(spe.healthStatus?.pendingCount || 0) > 0 ? `<span class="pending-count">${spe.healthStatus.pendingCount} pendente${spe.healthStatus.pendingCount > 1 ? 's' : ''}</span>` : ''}
                </div>
                
                <div class="spe-activity">
                    ${spe.lastActivity !== null
                ? `<span class="activity-indicator ${spe.lastActivity > 7 ? 'activity-indicator--stale' : 'activity-indicator--recent'}">
                                <i class="fa-solid fa-clock"></i> ${spe.lastActivity === 0 ? 'Hoje' : spe.lastActivity + 'd atrás'}
                           </span>`
                : `<span class="activity-indicator activity-indicator--stale"><i class="fa-solid fa-minus"></i> Sem registro</span>`
            }
                </div>
                
                <div class="spe-action">
                    <button class="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                        Abrir <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    },

    // ============================================================
    // 3.2. VISÃO OPERAÇÃO (SPE Detail - Analyst Workspace)
    // ============================================================

    openSpeDetail(speName) {
        this.state.activeSpeName = speName;
        this.state.activeTab = 'diario';
        this.state.currentView = 'operacao';
        this.render();
    },

    closeSpeDetail() {
        this.state.activeSpeName = null;
        this.state.currentView = 'carteira';
        this.render();
    },

    setActiveTab(tab) {
        this.state.activeTab = tab;
        this.render();
    },

    renderOperacao(container) {
        const speName = this.state.activeSpeName;
        if (!speName) {
            this.closeSpeDetail();
            return;
        }

        const speData = this.state.data.filter(d => d.razao_social_da_spe === speName);
        if (speData.length === 0) {
            container.innerHTML = `<div class="text-center p-12 text-slate-400">SPE não encontrada.</div>`;
            return;
        }

        const speInfo = speData[0];
        const milestones = this.getMilestones(speData);
        const healthStatus = this.getSpeStatus(speData);
        const activeTab = this.state.activeTab;

        container.innerHTML = `
            <div class="operacao-container fade-in">
                <!-- Header -->
                <div class="operacao-header">
                    <div class="operacao-header-left">
                        <button onclick="App.closeSpeDetail()" class="back-btn">
                            <i class="fa-solid fa-arrow-left"></i> Voltar
                        </button>
                        <div class="operacao-title">
                            <h2>${this.escapeHtml(speName)}</h2>
                            <p>${speInfo.razao_social_cliente}</p>
                        </div>
                    </div>
                    <div class="operacao-header-right">
                        <span class="fase-badge">${speInfo.fase_da_spe}</span>
                    </div>
                </div>

                <!-- Journey Bar Summary -->
                <div class="operacao-journey">
                    ${milestones.map((m, idx) => `
                        <div class="journey-step milestone-${m.status}">
                            <div class="journey-step-icon"><i class="fa-solid ${m.icon}"></i></div>
                            <div class="journey-step-info">
                                <span class="journey-step-label">${m.label}</span>
                                <span class="journey-step-date">${m.date ? WorkingHoursEngine.formatDate(m.date) : '-'}</span>
                            </div>
                        </div>
                        ${idx < milestones.length - 1 ? '<div class="journey-connector"></div>' : ''}
                    `).join('')}
                </div>

                <!-- Tab Navigation -->
                <div class="operacao-tabs">
                    <button class="tab-btn ${activeTab === 'diario' ? 'active' : ''}" onclick="App.setActiveTab('diario')">
                        <i class="fa-solid fa-book"></i> Diário de Bordo
                    </button>
                    <button class="tab-btn ${activeTab === 'cronograma' ? 'active' : ''}" onclick="App.setActiveTab('cronograma')">
                        <i class="fa-solid fa-calendar-alt"></i> Cronograma
                    </button>
                    <button class="tab-btn ${activeTab === 'cadastro' ? 'active' : ''}" onclick="App.setActiveTab('cadastro')">
                        <i class="fa-solid fa-info-circle"></i> Dados Cadastrais
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="operacao-content">
                    ${this.renderTabContent(activeTab, speName, speData, speInfo)}
                </div>
            </div>
        `;
    },

    renderTabContent(tab, speName, speData, speInfo) {
        switch (tab) {
            case 'diario':
                return this.renderTabDiario(speName);
            case 'cronograma':
                return this.renderTabCronograma(speName, speData);
            case 'cadastro':
                return this.renderTabCadastro(speInfo);
            default:
                return this.renderTabDiario(speName);
        }
    },

    // --- Tab A: Diário de Bordo ---
    renderTabDiario(speName) {
        const entries = this.state.journals[speName] || [];
        const speData = this.state.data.filter(d => d.razao_social_da_spe === speName);
        const milestones = this.getMilestones(speData);

        // Combine journal entries with milestone events
        const timeline = [
            ...entries.map(e => ({ ...e, type: 'journal' })),
            ...milestones.filter(m => m.date && m.status === 'done').map(m => ({
                id: m.key,
                date: m.date,
                type: 'milestone',
                label: m.label,
                icon: m.icon
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        return `
            <div class="diario-container">
                <!-- Input Form -->
                <div class="journal-form">
                    <h4><i class="fa-solid fa-plus-circle text-teal-600 mr-2"></i>Novo Registro</h4>
                    <div class="journal-form-row">
                        <select id="journal-type" class="journal-select">
                            <option value="reuniao">🤝 Reunião</option>
                            <option value="blocker">🚧 Blocker</option>
                            <option value="observacao">📝 Observação</option>
                            <option value="marco">🎯 Marco Atingido</option>
                        </select>
                        <input type="date" id="journal-date" class="journal-date" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <textarea id="journal-text" class="journal-textarea" placeholder="Descreva o que aconteceu..."></textarea>
                    <button onclick="App.submitJournalEntry('${this.escapeAttr(speName)}')" class="journal-submit">
                        <i class="fa-solid fa-save mr-2"></i>Salvar Registro
                    </button>
                </div>

                <!-- Timeline -->
                <div class="journal-timeline">
                    <h4><i class="fa-solid fa-history text-slate-500 mr-2"></i>Histórico</h4>
                    ${timeline.length === 0
                ? '<p class="no-entries">Nenhum registro encontrado.</p>'
                : timeline.map(item => this.renderTimelineItem(item, speName)).join('')
            }
                </div>
            </div>
        `;
    },

    renderTimelineItem(item, speName) {
        if (item.type === 'milestone') {
            return `
                <div class="timeline-entry milestone-entry">
                    <div class="timeline-icon bg-green-500"><i class="fa-solid ${item.icon}"></i></div>
                    <div class="timeline-body">
                        <div class="timeline-header">
                            <span class="timeline-badge bg-green-100 text-green-700">Marco</span>
                            <span class="timeline-date">${WorkingHoursEngine.formatDate(item.date)}</span>
                        </div>
                        <p class="timeline-text"><strong>${item.label}</strong> concluído</p>
                    </div>
                </div>
            `;
        }

        const typeConfig = {
            'reuniao': { icon: 'fa-handshake', color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
            'blocker': { icon: 'fa-exclamation-triangle', color: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
            'observacao': { icon: 'fa-sticky-note', color: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
            'marco': { icon: 'fa-flag-checkered', color: 'bg-green-500', badge: 'bg-green-100 text-green-700' }
        };
        const config = typeConfig[item.entryType] || typeConfig['observacao'];

        return `
            <div class="timeline-entry">
                <div class="timeline-icon ${config.color}"><i class="fa-solid ${config.icon}"></i></div>
                <div class="timeline-body">
                    <div class="timeline-header">
                        <span class="timeline-badge ${config.badge}">${item.entryType || 'Registro'}</span>
                        <span class="timeline-date">${WorkingHoursEngine.formatDate(item.date)}</span>
                        <button onclick="App.deleteJournalEntry('${this.escapeAttr(speName)}', ${item.id})" class="timeline-delete" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <p class="timeline-text">${this.escapeHtml(item.text)}</p>
                </div>
            </div>
        `;
    },

    submitJournalEntry(speName) {
        const typeEl = document.getElementById('journal-type');
        const dateEl = document.getElementById('journal-date');
        const textEl = document.getElementById('journal-text');

        if (!textEl.value.trim()) {
            this.showToast('Digite uma descrição', 'warning');
            return;
        }

        this.saveJournalEntry(speName, {
            entryType: typeEl.value,
            date: dateEl.value,
            text: textEl.value.trim()
        });

        this.showToast('Registro salvo!', 'success');
    },

    // --- Tab B: Cronograma (V2 Workflow Accordion) ---
    renderTabCronograma(speName, speData) {
        // Group tasks by esteira
        const groupedByEsteira = {};
        speData.forEach(task => {
            const esteira = task.esteira || 'Geral';
            if (!groupedByEsteira[esteira]) {
                groupedByEsteira[esteira] = [];
            }
            groupedByEsteira[esteira].push(task);
        });

        // Calculate workflow stats
        const workflowsHtml = Object.entries(groupedByEsteira).map(([esteiraName, tasks]) => {
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.is_done).length;
            const delayedTasks = tasks.filter(t => t.is_delayed && !t.is_done).length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const isExpanded = this.state.expandedItems[`wf_${esteiraName}`] !== false;
            const esteiraKey = this.escapeAttr(esteiraName);

            return `
                <div class="workflow-accordion">
                    <button class="workflow-accordion__header ${isExpanded ? 'workflow-accordion__header--expanded' : ''}" 
                            onclick="App.toggleAccordion('wf_${esteiraKey}')">
                        <div class="workflow-accordion__title">
                            <i class="fa-solid fa-chevron-right workflow-accordion__icon ${isExpanded ? 'workflow-accordion__icon--expanded' : ''}"></i>
                            <span class="workflow-accordion__name" style="color: ${this.getEsteiraColor(esteiraName)}">${this.escapeHtml(esteiraName)}</span>
                            ${delayedTasks > 0 ? `
                                <span class="workflow-accordion__delayed">
                                    <i class="fa-solid fa-exclamation-circle"></i> ${delayedTasks} atrasada${delayedTasks > 1 ? 's' : ''}
                                </span>
                            ` : ''}
                        </div>
                        <div class="flex items-center gap-4">
                            <div>
                                <div class="workflow-accordion__progress">
                                    <div class="workflow-accordion__progress-bar" style="width: ${progress}%; background-color: ${progress === 100 ? 'var(--status-success)' : 'var(--color-primary)'}"></div>
                                </div>
                            </div>
                            <span class="workflow-accordion__percentage">${progress}%</span>
                        </div>
                    </button>
                    <div class="workflow-accordion__content ${isExpanded ? 'workflow-accordion__content--expanded' : ''}">
                        <div class="divide-y divide-slate-100">
                            ${tasks.map(task => this.renderTaskRow(task, speName)).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="cronograma-container animate-fade-in">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-bold text-slate-800">
                        <i class="fa-solid fa-list-check text-indigo-600 mr-2"></i>
                        Cronograma de Tarefas
                    </h4>
                    <span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                        ${speData.length} Tarefas
                    </span>
                </div>
                ${workflowsHtml}
            </div>
        `;
    },

    // V2 Task Row Component with Date Columns
    renderTaskRow(task, speName) {
        const statusClass = task.is_done ? 'task-row--completed' :
            task.is_delayed ? 'task-row--delayed' :
                (task.status_real || '').toLowerCase().includes('bloq') ? 'task-row--blocked' : '';

        const checkboxClass = task.is_done ? 'task-row__checkbox--completed' :
            task.is_delayed ? 'task-row__checkbox--delayed' :
                (task.status_real || '').toLowerCase().includes('bloq') ? 'task-row__checkbox--blocked' : '';

        const responsibilityClass = (task.responsabilidade || '').toLowerCase().includes('trinus')
            ? 'task-row__responsibility--trinus'
            : 'task-row__responsibility--cliente';

        const isOverdue = task.is_delayed && !task.is_done;

        // Check if task was completed late (NEW LOGIC)
        const completedLate = task.is_done && task.conclusao_tarefa && task.data_prazo_sla && task.conclusao_tarefa > task.data_prazo_sla;

        return `
            <div class="task-row ${statusClass}">
                <div class="task-row__main">
                    <div class="task-row__left">
                        <div class="task-row__checkbox ${checkboxClass}">
                            ${task.is_done
                ? '<i class="fa-solid fa-check text-xs"></i>'
                : task.is_delayed
                    ? '<i class="fa-solid fa-exclamation text-xs"></i>'
                    : (task.status_real || '').toLowerCase().includes('bloq')
                        ? '<i class="fa-solid fa-ban text-xs"></i>'
                        : ''
            }
                        </div>
                        <div class="task-row__info">
                            <div class="task-row__name ${task.is_done ? 'task-row__name--completed' : ''}">
                                ${this.escapeHtml(task.nome_tarefa)}
                                ${completedLate ? '<span class="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Concluída com Atraso</span>' : ''}
                            </div>
                            <div class="task-row__meta">
                                ${task.responsabilidade ? `
                                    <span class="task-row__responsibility ${responsibilityClass}">
                                        ${task.responsabilidade}
                                    </span>
                                ` : ''}
                                ${task.nome_pendencia_ativa ? `
                                    <span class="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                        <i class="fa-solid fa-flag mr-1"></i>${this.escapeHtml(task.nome_pendencia_ativa)}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Date Columns Grid -->
                    <div class="task-row__dates">
                        <div class="task-date-col">
                            <span class="task-date-label">Criação</span>
                            <span class="task-date-value">
                                ${task.criacao_tarefa
                ? WorkingHoursEngine.formatDate(task.criacao_tarefa)
                : '<span class="text-slate-300">-</span>'
            }
                            </span>
                        </div>
                        
                        <div class="task-date-col">
                            <span class="task-date-label">Previsão (SLA)</span>
                            <span class="task-date-value ${isOverdue ? 'text-rose-600 font-semibold' : ''}">
                                ${task.data_prazo_sla
                ? `<i class="fa-solid fa-calendar mr-1"></i>${WorkingHoursEngine.formatDate(task.data_prazo_sla)}`
                : '<span class="text-slate-300">-</span>'
            }
                            </span>
                        </div>
                        
                        <div class="task-date-col">
                            <span class="task-date-label">Conclusão</span>
                            <span class="task-date-value ${completedLate ? 'text-amber-600 font-semibold' : ''}">
                                ${task.conclusao_tarefa
                ? `<i class="fa-solid fa-check-circle mr-1"></i>${WorkingHoursEngine.formatDate(task.conclusao_tarefa)}`
                : '<span class="text-slate-300">Em aberto</span>'
            }
                            </span>
                        </div>
                        
                        <div class="task-date-col">
                            <span class="task-date-label">SLA</span>
                            <span class="task-date-value">
                                ${task.sla_dias_uteis_padrao
                ? `<span class="font-mono text-xs bg-slate-100 px-2 py-1 rounded">${task.sla_dias_uteis_padrao}d úteis</span>`
                : '<span class="text-slate-300">-</span>'
            }
                            </span>
                        </div>
                    </div>
                </div>
                ${task.comentario_resolucao_pendencia ? `
                    <div class="task-row__comment">
                        <i class="fa-solid fa-comment-dots mr-2 text-slate-400"></i>${this.escapeHtml(task.comentario_resolucao_pendencia)}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // --- Tab C: Dados Cadastrais ---
    renderTabCadastro(speInfo) {
        return `
            <div class="cadastro-container">
                <div class="cadastro-grid">
                    <div class="cadastro-section">
                        <h4><i class="fa-solid fa-building mr-2 text-teal-600"></i>Identificação</h4>
                        <div class="cadastro-field">
                            <label>Razão Social</label>
                            <span>${this.escapeHtml(speInfo.razao_social_da_spe)}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>CNPJ</label>
                            <span>${speInfo.cnpj_da_spe || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Cliente</label>
                            <span>${this.escapeHtml(speInfo.razao_social_cliente)}</span>
                        </div>
                    </div>
                    
                    <div class="cadastro-section">
                        <h4><i class="fa-solid fa-cog mr-2 text-teal-600"></i>Sistema</h4>
                        <div class="cadastro-field">
                            <label>ERP</label>
                            <span>${speInfo.erp || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Código UAU</label>
                            <span>${speInfo.codigo_uau || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Process ID</label>
                            <span>${speInfo.process_id || '-'}</span>
                        </div>
                    </div>
                    
                    <div class="cadastro-section">
                        <h4><i class="fa-solid fa-tags mr-2 text-teal-600"></i>Contrato & Jornada</h4>
                        <div class="cadastro-field">
                            <label>Status Geral</label>
                            <span class="font-bold text-indigo-600">${speInfo.status_jornada_cliente || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Fase Atual</label>
                            <span>${speInfo.fase_da_spe || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>SLA Padrão</label>
                            <span>${speInfo.sla_dias_uteis_padrao || 5} dias úteis</span>
                        </div>
                        <div class="cadastro-field">
                            <label>TTV (Dias Corridos)</label>
                            <span class="badge badge-info">${speInfo.kpi_ttv_dias_corridos || 0} dias</span>
                        </div>
                    </div>

                    <div class="cadastro-section">
                        <h4><i class="fa-solid fa-calendar-check mr-2 text-teal-600"></i>Marcos Analíticos</h4>
                        <div class="cadastro-field">
                            <label>Assinatura do Contrato</label>
                            <span>${speInfo.data_inicio_contrato ? WorkingHoursEngine.formatDate(speInfo.data_inicio_contrato) : '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Handover Comercial</label>
                            <span>${speInfo.data_handover_comercial ? WorkingHoursEngine.formatDate(speInfo.data_handover_comercial) : '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Kick-off Cliente</label>
                            <span>${speInfo.data_kick_off_cliente ? WorkingHoursEngine.formatDate(speInfo.data_kick_off_cliente) : '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Viabilidade</label>
                            <span>${speInfo.data_apresentacao_viabilidade ? WorkingHoursEngine.formatDate(speInfo.data_apresentacao_viabilidade) : '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Financeira</label>
                            <span>${speInfo.data_inicio_financeira ? WorkingHoursEngine.formatDate(speInfo.data_inicio_financeira) : '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Carteira</label>
                            <span>${speInfo.data_inicio_carteira ? WorkingHoursEngine.formatDate(speInfo.data_inicio_carteira) : '-'}</span>
                        </div>
                    </div>


                </div>
            </div>
        `;
    },

    // ============================================================
    // 3.3. STRATEGIC VIEWS
    // ============================================================

    // --- VIEW: VISÃO GERAL (Overview) ---
    renderOverview(container) {
        const data = this.getFilteredData();
        const totalSPEs = [...new Set(data.map(d => d.razao_social_da_spe))].length;
        const totalTasks = data.length;
        const doneTasks = data.filter(d => d.is_done).length;
        const delayedTasks = data.filter(d => d.is_delayed).length;
        const pendingTasks = data.filter(d => !d.is_done).length;
        const slaPercent = totalTasks > 0 ? Math.round(((totalTasks - delayedTasks) / totalTasks) * 100) : 0;

        // Status distribution
        const statusCounts = data.reduce((acc, d) => {
            const status = d.status_real || 'Não Definido';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        // Phase distribution
        const phaseCounts = data.reduce((acc, d) => {
            const phase = d.fase_da_spe || 'Não Definida';
            acc[phase] = (acc[phase] || 0) + 1;
            return acc;
        }, {});

        container.innerHTML = `
            <div class="fade-in">
                <!-- KPI Cards -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="kpi-card bg-gradient-to-br from-blue-500 to-blue-600">
                        <i class="fa-solid fa-building text-3xl opacity-80"></i>
                        <div class="kpi-value">${totalSPEs}</div>
                        <div class="kpi-label">Total SPEs</div>
                    </div>
                    <div class="kpi-card bg-gradient-to-br from-teal-500 to-teal-600">
                        <i class="fa-solid fa-check-circle text-3xl opacity-80"></i>
                        <div class="kpi-value">${slaPercent}%</div>
                        <div class="kpi-label">Dentro do SLA</div>
                    </div>
                    <div class="kpi-card bg-gradient-to-br from-amber-500 to-amber-600">
                        <i class="fa-solid fa-hourglass-half text-3xl opacity-80"></i>
                        <div class="kpi-value">${pendingTasks}</div>
                        <div class="kpi-label">Pendências</div>
                    </div>
                    <div class="kpi-card bg-gradient-to-br from-red-500 to-red-600">
                        <i class="fa-solid fa-exclamation-circle text-3xl opacity-80"></i>
                        <div class="kpi-value">${delayedTasks}</div>
                        <div class="kpi-label">Em Atraso</div>
                    </div>
                </div>

                <!-- Charts Row -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="chart-container">
                        <h3 class="chart-title"><i class="fa-solid fa-chart-bar mr-2"></i>Distribuição por Status</h3>
                        <canvas id="statusChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3 class="chart-title"><i class="fa-solid fa-chart-pie mr-2"></i>Fases das SPEs</h3>
                        <canvas id="phasesChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        // Initialize Charts
        this.renderStatusChart(Object.keys(statusCounts), Object.values(statusCounts));
        this.renderPhasesChart(Object.keys(phaseCounts), Object.values(phaseCounts));
    },

    renderStatusChart(labels, values) {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        this.state.chartInstances.statusChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tarefas',
                    data: values,
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    },

    renderPhasesChart(labels, values) {
        const ctx = document.getElementById('phasesChart');
        if (!ctx) return;

        this.state.chartInstances.phasesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12 } }
                }
            }
        });
    },

    // --- VIEW: ESTEIRAS ---
    renderEsteiras(container) {
        const data = this.getFilteredData();

        // Aggregate by esteira
        const esteirasMap = data.reduce((acc, d) => {
            const est = d.esteira || 'Geral';
            if (!acc[est]) acc[est] = { total: 0, done: 0, delayed: 0, leadTimes: [] };
            acc[est].total++;
            if (d.is_done) acc[est].done++;
            if (d.is_delayed) acc[est].delayed++;
            if (d.lead_time) acc[est].leadTimes.push(d.lead_time);
            return acc;
        }, {});

        const esteiras = Object.entries(esteirasMap).map(([name, stats]) => ({
            name,
            total: stats.total,
            slaPercent: stats.total > 0 ? Math.round(((stats.total - stats.delayed) / stats.total) * 100) : 0,
            avgLeadTime: stats.leadTimes.length > 0
                ? Math.round(stats.leadTimes.reduce((a, b) => a + b, 0) / stats.leadTimes.length)
                : '-'
        }));

        container.innerHTML = `
            <div class="fade-in">
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="p-4 border-b border-slate-200 bg-slate-50">
                        <h3 class="font-bold text-slate-800"><i class="fa-solid fa-stream mr-2 text-teal-600"></i>Performance por Esteira</h3>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Esteira</th>
                                <th>Volume Total</th>
                                <th>% SLA</th>
                                <th>Lead Time Médio</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${esteiras.map(e => `
                                <tr>
                                    <td>
                                        <span class="esteira-badge" style="background-color: ${this.getEsteiraColor(e.name)}20; color: ${this.getEsteiraColor(e.name)}; border: 1px solid ${this.getEsteiraColor(e.name)}40">
                                            ${this.escapeHtml(e.name)}
                                        </span>
                                    </td>
                                    <td class="text-center font-semibold">${e.total}</td>
                                    <td class="text-center">
                                        <span class="sla-badge ${e.slaPercent >= 80 ? 'sla-good' : e.slaPercent >= 50 ? 'sla-warning' : 'sla-danger'}">
                                            ${e.slaPercent}%
                                        </span>
                                    </td>
                                    <td class="text-center text-slate-600">${e.avgLeadTime === '-' ? '-' : e.avgLeadTime + ' dias'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // --- VIEW: SLA & TEMPO ---
    renderSLA(container) {
        const data = this.getFilteredData();

        // Aggregate by esteira for comparison
        const esteirasMap = data.reduce((acc, d) => {
            const est = d.esteira || 'Geral';
            if (!acc[est]) acc[est] = { slaDays: [], leadTimes: [] };
            if (d.sla_dias_uteis_padrao) acc[est].slaDays.push(d.sla_dias_uteis_padrao);
            if (d.lead_time) acc[est].leadTimes.push(d.lead_time);
            return acc;
        }, {});

        const labels = Object.keys(esteirasMap);
        const slaData = labels.map(est => {
            const days = esteirasMap[est].slaDays;
            return days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
        });
        const leadTimeData = labels.map(est => {
            const times = esteirasMap[est].leadTimes;
            return times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        });

        container.innerHTML = `
            <div class="fade-in">
                <div class="chart-container">
                    <h3 class="chart-title"><i class="fa-solid fa-scale-balanced mr-2"></i>SLA Previsto vs Lead Time Real (por Esteira)</h3>
                    <canvas id="slaComparisonChart" style="max-height: 400px;"></canvas>
                </div>
                
                <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white rounded-lg p-4 border border-slate-200 text-center">
                        <div class="text-2xl font-bold text-blue-600">${Math.round(slaData.reduce((a, b) => a + b, 0) / (slaData.length || 1))}</div>
                        <div class="text-sm text-slate-500">SLA Médio (dias)</div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-slate-200 text-center">
                        <div class="text-2xl font-bold text-teal-600">${Math.round(leadTimeData.reduce((a, b) => a + b, 0) / (leadTimeData.length || 1))}</div>
                        <div class="text-sm text-slate-500">Lead Time Médio (dias)</div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-slate-200 text-center">
                        <div class="text-2xl font-bold ${leadTimeData.reduce((a, b) => a + b, 0) <= slaData.reduce((a, b) => a + b, 0) ? 'text-green-600' : 'text-red-600'}">
                            ${leadTimeData.reduce((a, b) => a + b, 0) <= slaData.reduce((a, b) => a + b, 0) ? '✓ OK' : '⚠ Atenção'}
                        </div>
                        <div class="text-sm text-slate-500">Status Geral</div>
                    </div>
                </div>
            </div>
        `;

        // Initialize comparison chart
        const ctx = document.getElementById('slaComparisonChart');
        if (ctx) {
            this.state.chartInstances.slaChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'SLA Previsto (dias)',
                            data: slaData,
                            backgroundColor: '#3b82f6',
                            borderRadius: 4
                        },
                        {
                            label: 'Lead Time Real (dias)',
                            data: leadTimeData,
                            backgroundColor: '#10b981',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'top' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Dias Úteis' } } }
                }
            });
        }
    },

    // --- VIEW: PENDÊNCIAS ---
    renderPendencias(container) {
        const data = this.getFilteredData();
        const pending = data.filter(d => !d.is_done);
        const today = new Date();

        // Calculate days delayed
        const pendenciasWithDelay = pending.map(d => {
            let diasAtraso = 0;
            if (d.data_prazo_sla) {
                const prazo = new Date(d.data_prazo_sla + 'T00:00:00');
                diasAtraso = Math.max(0, Math.floor((today - prazo) / (1000 * 60 * 60 * 24)));
            }
            return { ...d, diasAtraso };
        }).sort((a, b) => b.diasAtraso - a.diasAtraso);

        container.innerHTML = `
            <div class="fade-in">
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 class="font-bold text-slate-800"><i class="fa-solid fa-exclamation-triangle mr-2 text-amber-500"></i>Tarefas Pendentes (${pending.length})</h3>
                        <div class="text-sm text-slate-500">
                            <span class="text-red-600 font-semibold">${pending.filter(p => p.is_delayed).length}</span> em atraso
                        </div>
                    </div>
                    ${pending.length === 0 ? `
                        <div class="p-8 text-center text-slate-400">
                            <i class="fa-solid fa-check-circle text-4xl text-green-400 mb-2"></i>
                            <p>Nenhuma pendência encontrada!</p>
                        </div>
                    ` : `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>SPE</th>
                                    <th>Tarefa</th>
                                    <th>Dias em Atraso</th>
                                    <th>Responsável</th>
                                    <th>Comentários</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pendenciasWithDelay.map(p => `
                                    <tr class="${p.is_delayed ? 'row-delayed' : ''}">
                                        <td>
                                            <a href="#" onclick="App.router.go('company', { spe: '${this.escapeAttr(p.razao_social_da_spe)}' }); return false;" 
                                               class="text-teal-600 hover:text-teal-800 font-medium hover:underline">
                                                ${this.escapeHtml(p.razao_social_da_spe)}
                                            </a>
                                        </td>
                                        <td class="max-w-xs truncate" title="${this.escapeAttr(p.nome_tarefa)}">${this.escapeHtml(p.nome_tarefa)}</td>
                                        <td class="text-center">
                                            ${p.diasAtraso > 0
                ? `<span class="delay-badge">${p.diasAtraso} dias</span>`
                : '<span class="text-slate-400">-</span>'
            }
                                        </td>
                                        <td class="text-slate-600">${this.escapeHtml(p.responsabilidade)}</td>
                                        <td class="max-w-xs">
                                            ${p.comentario_resolucao_pendencia
                ? `<span class="text-sm text-slate-600" title="${this.escapeAttr(p.comentario_resolucao_pendencia)}">${this.escapeHtml(p.comentario_resolucao_pendencia.substring(0, 50))}${p.comentario_resolucao_pendencia.length > 50 ? '...' : ''}</span>`
                : '<span class="text-slate-400">-</span>'
            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    },

    // --- VIEW: DAILY OPERACIONAL (New) ---
    renderDaily(container) {
        const data = this.getFilteredData();
        const clients = this.groupByClientAndSpe();

        // Local filter state for status in this view
        if (this.state.filterDailyStatus === undefined) this.state.filterDailyStatus = '';

        container.innerHTML = `
            <div class="fade-in px-2">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">Daily Operacional</h2>
                        <p class="text-sm text-slate-500">Acompanhamento de projetos e registro de decisões.</p>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-filter text-slate-400"></i>
                        <span class="text-sm font-semibold text-slate-600">Filtro de Status:</span>
                    </div>
                    
                    <select onchange="App.setDailyStatusFilter(this.value)" class="u-select px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Todos os Status</option>
                        <option value="risk" ${this.state.filterDailyStatus === 'risk' ? 'selected' : ''}>Bloqueado / Risco Crítico</option>
                        <option value="attention" ${this.state.filterDailyStatus === 'attention' ? 'selected' : ''}>Em Atenção / Atraso</option>
                        <option value="ok" ${this.state.filterDailyStatus === 'ok' ? 'selected' : ''}>Em Andamento (OK)</option>
                        <option value="healthy" ${this.state.filterDailyStatus === 'healthy' ? 'selected' : ''}>Concluído / Ativo</option>
                    </select>
                </div>

                <div class="grid grid-cols-1 gap-4">
                    ${this.renderDailyList(clients)}
                </div>
            </div>
        `;
    },

    setDailyStatusFilter(status) {
        this.state.filterDailyStatus = status;
        this.render();
    },

    renderDailyList(clients) {
        let html = '';
        clients.forEach(client => {
            const filteredSpes = client.spes.filter(spe => {
                if (!this.state.filterDailyStatus) return true;
                return spe.healthStatus.status === this.state.filterDailyStatus;
            });

            if (filteredSpes.length === 0) return;

            html += `
                <div class="mb-6">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 border-l-2 border-indigo-500 ml-1 pl-3">${client.name}</h3>
                    <div class="space-y-4">
                        ${filteredSpes.map(spe => this.renderDailyCard(spe)).join('')}
                    </div>
                </div>
            `;
        });

        return html || '<div class="text-center p-12 text-slate-400 border-2 border-dashed rounded-xl">Nenhum projeto encontrado com os filtros atuais.</div>';
    },

    renderDailyCard(spe) {
        const lastNote = (this.state.journals[spe.name] || []).filter(j => j.type === 'DAILY').slice(-1)[0];
        const status = spe.healthStatus;
        const blockers = spe.tasks.filter(t => (t.status_real || '').toLowerCase().includes('bloq') && !t.is_done);

        return `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-300 transition-all">
                <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 bg-slate-50/30">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                             <i class="fa-solid fa-building text-indigo-500"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800">${this.escapeHtml(spe.name)}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${status.color === 'red' ? 'bg-red-100 text-red-700' : status.color === 'amber' ? 'bg-amber-100 text-amber-700' : status.color === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}">
                                    ${status.label}
                                </span>
                                <span class="text-[10px] text-slate-400 font-medium">${spe.fase}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                             <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Última Daily</div>
                             <div class="text-xs font-semibold text-slate-600">
                                ${lastNote ? WorkingHoursEngine.formatDate(lastNote.date) : '<span class="text-slate-300">Nunca</span>'}
                             </div>
                        </div>
                        <button onclick="App.setView('company', { spe: '${this.escapeAttr(spe.name)}' })" class="u-btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs px-3 py-1.5 shadow-sm">
                            Detalhes <i class="fa-solid fa-arrow-right ml-1"></i>
                        </button>
                    </div>
                </div>
                
                <div class="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h5 class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-3">
                            <i class="fa-solid fa-triangle-exclamation text-amber-500 text-xs"></i> Bloqueios & Pendências Críticas
                        </h5>
                        ${blockers.length > 0 ? `
                            <div class="space-y-2">
                                ${blockers.slice(0, 3).map(b => `
                                    <div class="flex items-start gap-2 text-xs text-slate-700 bg-red-50/50 p-2.5 rounded-lg border border-red-100/50">
                                        <div class="mt-0.5"><i class="fa-solid fa-ban text-red-500 text-[10px]"></i></div>
                                        <div>
                                            <p class="font-semibold leading-tight">${this.escapeHtml(b.nome_tarefa)}</p>
                                            <p class="text-[10px] text-slate-500 mt-1">Resp: ${this.escapeHtml(b.responsabilidade)}</p>
                                        </div>
                                    </div>
                                `).join('')}
                                ${blockers.length > 3 ? `<p class="text-[10px] text-slate-400 italic mt-2 ml-1">+ ${blockers.length - 3} outros bloqueios técnicos</p>` : ''}
                            </div>
                        ` : `
                            <div class="flex flex-col items-center justify-center p-6 border border-dashed border-slate-100 rounded-lg bg-slate-50/50">
                                <i class="fa-solid fa-check-circle text-emerald-400 text-xl mb-2"></i>
                                <span class="text-xs text-slate-400 italic">Operação rodando sem pontos de bloqueio.</span>
                            </div>
                        `}
                    </div>
                    
                    <div class="flex flex-col">
                        <h5 class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-3">
                            <i class="fa-solid fa-pen-to-square text-indigo-500 text-xs"></i> Registro de Decisão / Daily Log
                        </h5>
                        <div class="flex flex-col gap-3 flex-1">
                            <textarea 
                                id="daily-note-${this.escapeAttr(spe.name)}"
                                class="w-full text-xs border border-slate-200 rounded-lg p-3 h-28 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner bg-slate-50/20"
                                placeholder="Registre aqui as decisões acordadas na daily, próximos passos críticos ou alinhamentos para resolução..."
                            >${lastNote ? this.escapeHtml(lastNote.text) : ''}</textarea>
                            <button 
                                id="btn-save-daily-${this.escapeAttr(spe.name)}"
                                onclick="App.saveDailyLog('${this.escapeAttr(spe.name)}')"
                                class="u-btn u-btn-primary self-end py-1.5 px-4 text-[10px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-transform"
                            >
                                <i class="fa-solid fa-save mr-1"></i> Salvar Registro
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    saveDailyLog(speName) {
        const text = document.getElementById(`daily-note-${speName}`).value;
        const btn = document.getElementById(`btn-save-daily-${speName}`);

        if (!text.trim()) {
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 500);
            return;
        }

        this.saveJournalEntry(speName, {
            text: text,
            type: 'DAILY',
            date: new Date().toISOString().split('T')[0]
        });

        // Visual Feedback
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Salvo com Sucesso';
        btn.classList.remove('u-btn-primary');
        btn.classList.add('bg-emerald-500', 'text-white');

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('bg-emerald-500', 'text-white');
            btn.classList.add('u-btn-primary');
        }, 2000);
    },


    // --- VIEW: DRILL-DOWN (Empresa/SPE) ---
    renderCompanyDrilldown(container) {
        const speName = this.state.routeParams.spe;
        if (!speName) {
            container.innerHTML = `
                <div class="text-center p-12 text-slate-400">
                    <i class="fa-solid fa-building text-4xl mb-4"></i>
                    <p>Selecione uma SPE para ver os detalhes.</p>
                    <button onclick="App.setView('pendencias')" class="mt-4 u-btn u-btn-primary">
                        <i class="fa-solid fa-arrow-left mr-2"></i>Voltar às Pendências
                    </button>
                </div>
            `;
            return;
        }

        const speData = this.state.data.filter(d => d.razao_social_da_spe === speName);
        if (speData.length === 0) {
            container.innerHTML = `<div class="text-center p-12 text-slate-400">SPE não encontrada.</div>`;
            return;
        }

        const speInfo = speData[0];
        const sortedTasks = [...speData].sort((a, b) => {
            const dateA = a.criacao_tarefa || '';
            const dateB = b.criacao_tarefa || '';
            return dateA.localeCompare(dateB);
        });

        container.innerHTML = `
            <div class="fade-in">
                <!-- Header -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div class="flex items-start justify-between">
                        <div>
                            <button onclick="App.setView('pendencias')" class="text-sm text-slate-500 hover:text-teal-600 mb-2">
                                <i class="fa-solid fa-arrow-left mr-1"></i>Voltar
                            </button>
                            <h2 class="text-2xl font-bold text-slate-800">${this.escapeHtml(speName)}</h2>
                            <p class="text-slate-500">${speInfo.cnpj_da_spe || 'CNPJ não informado'}</p>
                        </div>
                        <div class="text-right">
                            <span class="px-3 py-1 rounded-full text-sm font-semibold bg-teal-100 text-teal-700">${speInfo.fase_da_spe}</span>
                            <p class="text-xs text-slate-400 mt-1">${speInfo.razao_social_cliente}</p>
                        </div>
                    </div>
                </div>

                <!-- Timeline -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 class="font-bold text-slate-800 mb-4"><i class="fa-solid fa-timeline mr-2 text-teal-600"></i>Timeline de Tarefas</h3>
                    <div class="timeline">
                        ${sortedTasks.map((task, idx) => `
                            <div class="timeline-item ${task.is_done ? 'done' : ''} ${task.is_delayed ? 'delayed' : ''}">
                                <div class="timeline-marker ${task.is_done ? 'bg-green-500' : task.is_delayed ? 'bg-red-500' : 'bg-blue-500'}"></div>
                                <div class="timeline-content">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <h4 class="font-semibold text-slate-700">${this.escapeHtml(task.nome_tarefa)}</h4>
                                            <p class="text-xs text-slate-500">${task.esteira} • ${task.responsabilidade}</p>
                                        </div>
                                        <div class="text-right text-xs">
                                            <div class="text-slate-400">${WorkingHoursEngine.formatDate(task.criacao_tarefa)}</div>
                                            ${task.conclusao_tarefa
                ? `<div class="text-green-600">Concluída: ${WorkingHoursEngine.formatDate(task.conclusao_tarefa)}</div>`
                : `<div class="text-amber-600">Prazo: ${WorkingHoursEngine.formatDate(task.data_prazo_sla)}</div>`
            }
                                        </div>
                                    </div>
                                    ${task.comentario_resolucao_pendencia ? `
                                        <div class="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                            <i class="fa-solid fa-comment mr-1"></i>${this.escapeHtml(task.comentario_resolucao_pendencia)}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // --- VIEW: DASHBOARD (V2 - Visão Geral Executiva) ---
    renderDashboard(container) {
        const data = this.getFilteredData();

        if (data.length === 0) {
            container.innerHTML = `<div class="text-center p-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <i class="fa-solid fa-inbox text-4xl mb-4"></i><br>Nenhum dado encontrado.<br>Importe uma planilha ou limpe os filtros.
            </div>`;
            return;
        }

        // Calculate Metrics
        const uniqueClients = [...new Set(data.map(d => d.razao_social_cliente))];
        const totalClients = uniqueClients.length;

        const uniqueSPEs = [...new Set(data.map(d => d.razao_social_da_spe))];
        const totalSPEs = uniqueSPEs.length;

        // Status counts for companies (per SPE, using status_jornada_cliente)
        const speStatusMap = {};
        data.forEach(d => {
            const spe = d.razao_social_da_spe;
            if (!speStatusMap[spe]) {
                const status = (d.status_jornada_cliente || d.status_global_processo || '').toLowerCase();
                let statusType = 'onTrack';

                if (status.includes('conclu') || status.includes('finaliz')) statusType = 'completed';
                else if (status.includes('bloq') || status.includes('parado') || status.includes('suspen')) statusType = 'blocked';
                else if (status.includes('risco') || status.includes('atras') || status.includes('atraso')) statusType = 'atRisk';

                speStatusMap[spe] = statusType;
            }
        });

        const speStatusCounts = {
            onTrack: Object.values(speStatusMap).filter(s => s === 'onTrack').length,
            atRisk: Object.values(speStatusMap).filter(s => s === 'atRisk').length,
            blocked: Object.values(speStatusMap).filter(s => s === 'blocked').length,
            completed: Object.values(speStatusMap).filter(s => s === 'completed').length,
            total: Object.keys(speStatusMap).length
        };

        // Time since kickoff (days open)
        const today = new Date();
        const speDaysOpen = {};
        data.forEach(d => {
            const spe = d.razao_social_da_spe;
            const kickoff = d.data_kick_off || d.data_inicio_jornada || d.criacao_tarefa;
            if (kickoff && !speDaysOpen[spe]) {
                const kickDate = new Date(kickoff);
                if (!isNaN(kickDate.getTime())) {
                    const days = Math.floor((today - kickDate) / (1000 * 60 * 60 * 24));
                    speDaysOpen[spe] = days;
                }
            }
        });

        const daysArray = Object.values(speDaysOpen).filter(d => d > 0);
        const minDays = daysArray.length > 0 ? Math.min(...daysArray) : 0;
        const maxDays = daysArray.length > 0 ? Math.max(...daysArray) : 0;
        const avgDays = daysArray.length > 0 ? Math.round(daysArray.reduce((a, b) => a + b, 0) / daysArray.length) : 0;

        // Consolidated Status for Esteiras (Process + Esteira)
        const esteiraStatusMap = {};
        data.forEach(d => {
            const key = `${d.process_id}_${d.esteira}`;
            if (!esteiraStatusMap[key]) {
                const status = (d.status_esteira_detalhado || '').toLowerCase();
                let statusType = 'onTrack';
                if (status.includes('conclu') || status.includes('finaliz')) statusType = 'completed';
                else if (status.includes('bloq') || status.includes('parado') || status.includes('suspen')) statusType = 'blocked';
                else if (status.includes('risco') || status.includes('atras') || status.includes('atraso')) statusType = 'atRisk';

                esteiraStatusMap[key] = {
                    type: statusType,
                    name: d.esteira || 'Geral'
                };
            }
        });

        const distinctEsteiras = Object.values(esteiraStatusMap);
        const statusCounts = {
            onTrack: distinctEsteiras.filter(e => e.type === 'onTrack').length,
            atRisk: distinctEsteiras.filter(e => e.type === 'atRisk').length,
            blocked: distinctEsteiras.filter(e => e.type === 'blocked').length,
            completed: distinctEsteiras.filter(e => e.type === 'completed').length,
            total: distinctEsteiras.length
        };

        const html = `
            <div class="space-y-6 animate-fade-in">
                <!-- Header -->
                <div class="flex justify-between items-end mb-2">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">Visão Geral Executiva</h2>
                        <p class="text-sm text-slate-500">Visão macro da saúde do portfólio e gargalos.</p>
                    </div>
                    <div class="text-xs text-slate-400">Atualizado: Agora mesmo</div>
                </div>

                <!-- Metric Cards Grid - Simplified -->
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-card__content">
                            <p class="metric-card__title">Clientes</p>
                            <h3 class="metric-card__value">${totalClients}</h3>
                            <p class="text-xs text-slate-400">Grupos econômicos ativos</p>
                        </div>
                        <div class="metric-card__icon metric-card__icon--primary">
                            <i class="fa-solid fa-users"></i>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-card__content">
                            <p class="metric-card__title">Empresas (SPEs)</p>
                            <h3 class="metric-card__value">${totalSPEs}</h3>
                            <p class="text-xs text-slate-400">Total de SPEs em onboarding</p>
                        </div>
                        <div class="metric-card__icon metric-card__icon--info">
                            <i class="fa-solid fa-building"></i>
                        </div>
                    </div>
                </div>

                <!-- Charts Row -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Status Chart -->
                    <div class="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                        <h3 class="text-lg font-bold text-slate-800 mb-4">Saúde das Esteiras</h3>
                        <div class="space-y-4">
                            ${this.renderStatusBar('Em Dia', statusCounts.onTrack, statusCounts.total, 'bg-emerald-500')}
                            ${this.renderStatusBar('Em Risco', statusCounts.atRisk, statusCounts.total, 'bg-amber-500')}
                            ${this.renderStatusBar('Bloqueado', statusCounts.blocked, statusCounts.total, 'bg-slate-800')}
                            ${this.renderStatusBar('Concluído', statusCounts.completed, statusCounts.total, 'bg-blue-500')}
                        </div>
                    </div>

                    <!-- Phase Distribution -->
                    <div class="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                        <h3 class="text-lg font-bold text-slate-800 mb-4">Esteiras Ativas</h3>
                        <div id="phase-chart" class="h-64">
                            ${this.renderPhaseDistribution(distinctEsteiras)}
                        </div>
                    </div>
                </div>

                <!-- Quick List -->
                <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 class="text-lg font-bold text-slate-800">Atividade Recente e Status</h3>
                    </div>
                    <div class="divide-y divide-slate-100">
                        ${this.renderQuickList()}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    // Helper: Render status bar for dashboard
    renderStatusBar(label, count, total, colorClass) {
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        return `
            <div class="flex items-center gap-4">
                <span class="w-20 text-sm font-medium text-slate-600">${label}</span>
                <div class="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                    <div class="h-full ${colorClass} transition-all duration-500" style="width: ${percent}%"></div>
                </div>
                <span class="w-12 text-sm font-bold text-slate-700 text-right">${count}</span>
            </div>
        `;
    },

    // Helper: Render phase distribution based on unique Esteiras
    renderPhaseDistribution(distinctEsteiras) {
        if (!distinctEsteiras) return '<div class="p-4 text-center text-slate-400">Sem dados</div>';

        const esteiraCounts = {};
        distinctEsteiras.forEach(e => {
            esteiraCounts[e.name] = (esteiraCounts[e.name] || 0) + 1;
        });

        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
        let html = '<div class="space-y-3 pt-2">';
        Object.entries(esteiraCounts)
            .sort((a, b) => b[1] - a[1]) // Sort by count
            .slice(0, 7) // Show up to 7 types
            .forEach(([name, count], i) => {
                html += `
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full" style="background: ${colors[i % colors.length]}"></div>
                        <span class="flex-1 text-sm text-slate-600 truncate">${name}</span>
                        <span class="text-sm font-bold text-slate-700">${count}</span>
                    </div>
                `;
            });
        html += '</div>';
        return html;
    },

    // Helper: Render quick list for dashboard
    renderQuickList() {
        const grouped = this.groupByClientAndSpe();
        const clients = Object.values(grouped).slice(0, 5);

        if (clients.length === 0) {
            return '<div class="p-6 text-center text-slate-400">Nenhum dado disponível</div>';
        }

        let html = '';
        clients.forEach(client => {
            Object.values(client.spes).forEach(spe => {
                const status = spe.healthStatus || { status: 'ok', label: 'Saudável', color: 'teal' };
                const statusClass = status.status === 'risk' ? 'status-badge--delayed' :
                    status.status === 'attention' ? 'status-badge--at-risk' :
                        status.status === 'healthy' ? 'status-badge--completed' : 'status-badge--on-track';

                html += `
                    <div class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
                         onclick="App.navigateToOperacao('${this.escapeAttr(spe.name)}')">
                        <div class="flex items-center gap-4">
                            <div class="w-2 h-2 rounded-full ${status.color === 'red' ? 'bg-rose-500' : status.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}"></div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">${this.escapeHtml(spe.name)}</p>
                                </div>
                                <p class="text-xs text-slate-500">${this.escapeHtml(client.name)}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-6">
                            <div class="text-right hidden sm:block">
                                <p class="text-xs text-slate-400">Fase Atual</p>
                                <p class="text-sm font-medium text-slate-700">${spe.fase || 'Em andamento'}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="status-badge ${statusClass}">${status.label}</span>
                                <i class="fa-solid fa-arrow-right text-slate-300 group-hover:text-indigo-500"></i>
                            </div>
                        </div>
                    </div>
                `;
            });
        });
        return html;
    },

    // --- VIEW: CALENDAR (Grid System Portado da App 1) ---
    renderCalendar(container) {
        const year = this.state.currentMonth.getFullYear();
        const month = this.state.currentMonth.getMonth();
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        // Navigation Header
        const nav = document.createElement('div');
        nav.className = 'flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 fade-in';
        nav.innerHTML = `
            <button onclick="App.navMonth(-1)" class="p-2 hover:bg-slate-50 rounded-lg text-slate-600"><i class="fa-solid fa-chevron-left"></i></button>
            <div class="text-center">
                <h2 class="text-xl font-bold text-slate-800 capitalize">${monthNames[month]} <span class="text-teal-600">${year}</span></h2>
            </div>
            <button onclick="App.navMonth(1)" class="p-2 hover:bg-slate-50 rounded-lg text-slate-600"><i class="fa-solid fa-chevron-right"></i></button>
        `;
        container.appendChild(nav);

        // Grid Container
        const grid = document.createElement('div');
        grid.className = 'calendar-month fade-in';

        // Week Headers
        const weekHeader = document.createElement('div');
        weekHeader.className = 'calendar-week-row';
        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(d => {
            const cell = document.createElement('div');
            cell.className = 'calendar-week-day';
            cell.textContent = d;
            weekHeader.appendChild(cell);
        });
        grid.appendChild(weekHeader);

        // Days Logic
        const daysBody = document.createElement('div');
        daysBody.className = 'calendar-grid';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty cells before start
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day bg-slate-50/30';
            daysBody.appendChild(empty);
        }

        const visibleData = this.getFilteredData();

        // Group data by SPE to calculate date ranges
        const speRanges = {};
        visibleData.forEach(task => {
            const spe = task.razao_social_da_spe;
            const start = task.data_kick_off || task.data_inicio_jornada || task.criacao_tarefa;
            const end = task.conclusao_tarefa || task.data_prazo_sla;

            if (!spe) return;
            if (!speRanges[spe]) {
                speRanges[spe] = {
                    name: spe,
                    start: start,
                    end: end,
                    status: task.status_global_processo || 'Em Andamento'
                };
            } else {
                if (start && (!speRanges[spe].start || start < speRanges[spe].start)) speRanges[spe].start = start;
                if (end && (!speRanges[spe].end || end > speRanges[spe].end)) speRanges[spe].end = end;
            }
        });

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isToday = dateStr === new Date().toISOString().split('T')[0];

            const cell = document.createElement('div');
            cell.className = `calendar-day group ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`;

            // Header do Dia
            cell.innerHTML = `
                <div class="day-header">
                    <span class="day-number">${d}</span>
                    <div class="day-actions">
                        <button onclick="App.openAnnotationModal('${dateStr}')"><i class="fa-regular fa-note-sticky"></i></button>
                        <button onclick="App.openEventModal('${dateStr}')"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
                <div class="flex flex-col gap-1 mt-1 overflow-hidden"></div>
            `;

            const content = cell.querySelector('.flex-col');

            // 1. Barras de Empresas (Grouped Logic)
            Object.values(speRanges).forEach(spe => {
                if (!spe.start || !spe.end) return;

                if (dateStr >= spe.start && dateStr <= spe.end) {
                    const isStart = dateStr === spe.start;
                    const isEnd = dateStr === spe.end;

                    // Determine color based on status
                    let color = 'var(--color-primary)';
                    const status = spe.status.toLowerCase();
                    if (status.includes('conclu')) color = 'var(--status-success)';
                    if (status.includes('bloq') || status.includes('suspen')) color = 'var(--status-danger)';
                    if (status.includes('risco') || status.includes('atras')) color = 'var(--status-warning)';

                    const bar = document.createElement('div');
                    bar.className = `esteira-bar ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${!isStart && !isEnd ? 'middle' : ''}`;
                    bar.style.backgroundColor = color;
                    bar.textContent = isStart ? `🏢 ${spe.name}` : '';
                    if (isStart) bar.title = `${spe.name} (Início via ${spe.start})`;
                    if (isEnd) bar.title = `${spe.name} (Fim via ${spe.end})`;

                    // Add click and cursor
                    bar.style.cursor = 'pointer';
                    bar.onclick = (e) => {
                        e.stopPropagation();
                        App.router.go('company', { spe: spe.name });
                    };

                    content.appendChild(bar);
                }
            });

            // 2. Eventos Manuais
            const dayEvents = this.state.events[dateStr] || [];
            dayEvents.forEach(evt => {
                const dot = document.createElement('div');
                dot.className = 'event-dot';
                dot.innerHTML = `<i class="fa-solid fa-circle text-[6px] text-teal-600"></i> <span class="truncate">${evt.title}</span>`;
                content.appendChild(dot);
            });

            // 3. Anotações
            const note = this.state.annotations[dateStr];
            if (note) {
                const noteIcon = document.createElement('div');
                noteIcon.className = 'text-[10px] text-amber-500 mt-1 bg-amber-50 p-1 rounded border border-amber-100 truncate';
                noteIcon.innerHTML = `<i class="fa-solid fa-sticky-note mr-1"></i>${note}`;
                content.appendChild(noteIcon);
            }

            daysBody.appendChild(cell);
        }

        grid.appendChild(daysBody);
        container.appendChild(grid);
    },

    // ============================================================
    // 4. DATA PROCESSING (Hierarchy Builder)
    // ============================================================
    buildHierarchy() {
        const raw = this.getFilteredData();
        const clientsMap = {};

        raw.forEach(row => {
            // Normalização usando novo modelo
            const clientName = row.razao_social_cliente || 'Sem Cliente';
            const speName = row.razao_social_da_spe || clientName;
            const estName = row.esteira || 'Geral';

            if (!clientsMap[clientName]) {
                clientsMap[clientName] = {
                    name: clientName,
                    spesMap: {},
                    totalTasks: 0
                };
            }
            const client = clientsMap[clientName];

            if (!client.spesMap[speName]) {
                client.spesMap[speName] = {
                    name: speName,
                    cnpj: row.cnpj_da_spe || '',
                    fase: row.fase_da_spe || '',
                    servicos: row.servicos_contratados || '',
                    esteirasMap: {},
                    hasIssues: false,
                    tasksCount: 0
                };
            }
            const spe = client.spesMap[speName];

            if (!spe.esteirasMap[estName]) {
                spe.esteirasMap[estName] = { name: estName, total: 0, done: 0, tasks: [] };
            }
            const est = spe.esteirasMap[estName];

            client.totalTasks++;
            spe.tasksCount++;
            est.total++;
            est.tasks.push(row);

            const statusLower = (row.status_real || '').toLowerCase();
            if (statusLower.includes('conclu')) est.done++;
            if (statusLower.includes('bloqueada') || statusLower.includes('pendente')) spe.hasIssues = true;
        });

        // Transforma Map em Array para renderização
        return Object.values(clientsMap).map(c => {
            c.spes = Object.values(c.spesMap).map(s => {
                s.esteiras = Object.values(s.esteirasMap);
                const totalSpe = s.esteiras.reduce((acc, curr) => acc + curr.total, 0);
                const doneSpe = s.esteiras.reduce((acc, curr) => acc + curr.done, 0);
                s.percent = totalSpe ? Math.round((doneSpe / totalSpe) * 100) : 0;
                return s;
            });
            return c;
        });
    },

    getFilteredData() {
        let data = this.state.data;

        // Filter by client
        if (this.state.filterClient) {
            data = data.filter(d => d.razao_social_cliente === this.state.filterClient);
        }

        // Filter by service (includes-based matching)
        if (this.state.filterService) {
            const targetService = this.state.filterService;
            data = data.filter(d => {
                const servicos = d.servicos_contratados;
                if (Array.isArray(servicos)) {
                    return servicos.includes(targetService);
                } else if (typeof servicos === 'string') {
                    return servicos.split(',').map(s => s.trim()).includes(targetService);
                }
                return false;
            });
        }

        return data;
    },

    // ============================================================
    // 5. IMPORTAÇÃO & NORMALIZAÇÃO (Aplicando WorkingHoursEngine)
    // ============================================================

    processImportedData(jsonData) {
        return jsonData.map((row, index) => {
            // Normaliza as chaves do Excel (lowercase e trim) para evitar erros
            const n = {};
            Object.keys(row).forEach(k => n[k.toLowerCase().trim().replace(/\s+/g, '_')] = row[k]);

            const criacao = this.parseExcelDate(n.criacao_tarefa || n.criacao);
            const conclusao = this.parseExcelDate(n.conclusao_tarefa || n.conclusao);
            const prazoSLA = this.parseExcelDate(n.data_prazo_sla || n.prazo) || (criacao ? WorkingHoursEngine.addWorkingDays(criacao, parseInt(n.sla_dias_uteis_padrao || n.sla) || 5) : null);
            const statusReal = n.status_real || n.status || 'Aberta';
            const comentario = n.comentario_resolucao_pendencia || n.comentario || '';

            // Verifica se status é concluído
            const isConcluded = statusReal.toLowerCase().includes('conclu');
            const today = new Date().toISOString().split('T')[0];

            // Mapeamento completo do modelo granular
            return {
                id: n.id || n.task_id || `t-${index}`,

                // Dados do Cliente/SPE
                razao_social_cliente: n.razao_social_cliente || n.cliente || 'Cliente Desconhecido',
                razao_social_da_spe: n.razao_social_da_spe || n.spe || n.razao_social_cliente || 'SPE Desconhecida',
                cnpj_da_spe: n.cnpj_da_spe || n.cnpj || '',

                // ERP/Sistema
                erp: n.erp || '',
                codigo_uau: parseInt(n.codigo_uau) || null,

                // Fase e Serviços
                fase_da_spe: n.fase_da_spe || n.fase || 'Não definida',
                servicos_contratados: n.servicos_contratados || n.servicos || '',
                sla_dias_uteis_padrao: parseInt(n.sla_dias_uteis_padrao || n.sla) || 5,

                // Identificadores de Processo
                process_id: n.process_id || `PROC-${index}`,
                task_id: n.task_id || `TASK-${index}`,

                // Dados da Tarefa
                nome_tarefa: n.nome_tarefa || n.tarefa || 'Tarefa sem nome',
                classificacao_tarefa: n.classificacao_tarefa || n.classificacao || 'Geral',
                responsabilidade: n.responsabilidade || n.responsavel || 'Não atribuído',
                esteira: n.esteira || 'Geral',

                // Status
                status_real: statusReal,
                status_esteira_detalhado: n.status_esteira_detalhado || n.status_detalhado || '',
                comentario_resolucao_pendencia: comentario,

                // Datas
                criacao_tarefa: criacao,
                conclusao_tarefa: conclusao,
                data_prazo_sla: prazoSLA,

                // Datas do Contrato
                data_inicio_contrato: this.parseExcelDate(n.data_inicio_contrato || n.inicio_contrato),
                data_kick_off_cliente: this.parseExcelDate(n.data_kick_off_cliente || n.kick_off),
                data_inicio_financeira: this.parseExcelDate(n.data_inicio_financeira),
                data_apresentacao_viabilidade: this.parseExcelDate(n.data_apresentacao_viabilidade),
                data_inicio_carteira: this.parseExcelDate(n.data_inicio_carteira),

                // ===== COMPUTED PROPERTIES =====
                // is_delayed: tarefa em atraso (hoje > prazo SLA E não concluída)
                is_delayed: !isConcluded && prazoSLA && today > prazoSLA,

                // lead_time: dias úteis entre criação e conclusão (ou null se não concluída)
                lead_time: conclusao ? WorkingHoursEngine.calcBusinessDays(criacao, conclusao) : null,

                // aging_bucket: classificação por tempo de abertura (para tarefas não concluídas)
                aging_bucket: !isConcluded ? WorkingHoursEngine.getAgingBucket(criacao) : null,

                // causa_raiz: classificação do comentário de pendência
                causa_raiz: WorkingHoursEngine.classifyCausaRaiz(comentario),

                // is_done: flag simplificada para filtragens
                is_done: isConcluded
            };
        });
    },

    // Enriquece dados existentes com propriedades computadas (para demo data e dados do localStorage)
    enrichData(data) {
        const today = new Date().toISOString().split('T')[0];
        return data.map(row => {
            const isConcluded = (row.status_real || '').toLowerCase().includes('conclu');
            return {
                ...row,
                is_delayed: !isConcluded && row.data_prazo_sla && today > row.data_prazo_sla,
                lead_time: row.conclusao_tarefa ? WorkingHoursEngine.calcBusinessDays(row.criacao_tarefa, row.conclusao_tarefa) : null,
                aging_bucket: !isConcluded ? WorkingHoursEngine.getAgingBucket(row.criacao_tarefa) : null,
                causa_raiz: WorkingHoursEngine.classifyCausaRaiz(row.comentario_resolucao_pendencia),
                is_done: isConcluded
            };
        });
    },

    parseExcelDate(val) {
        if (!val) return null;

        // Se já é uma string ISO válida
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;

        // Se for um objeto Date do JavaScript (formato mais comum do SheetJS)
        if (val instanceof Date) {
            if (!isNaN(val.getTime())) {
                return val.toISOString().split('T')[0];
            }
            return null;
        }

        // Se for serial do Excel (número)
        if (typeof val === 'number') {
            // Excel serial date to JS Date object
            // Excel starts on Dec 30, 1899 (mostly)
            const date = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        }

        // Tentar converter string legível (DD/MM/YYYY) para ISO
        if (typeof val === 'string' && val.includes('/')) {
            const parts = val.split('/');
            if (parts.length === 3) {
                // assume DD/MM/YYYY
                const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                return iso;
            }
        }

        // Tentar parsear string de data genérica
        if (typeof val === 'string') {
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        }

        return null;
    },

    // ============================================================
    // 5.1. MULTI-SOURCE ETL (3-Layer Data Model)
    // ============================================================

    // Import state for multi-file mode
    importState: {
        mode: 'single', // 'single' or 'multi'
        workbook: null,
        sheets: { processos: null, esteiras: null, tarefas: null },
        files: { processos: null, esteiras: null, tarefas: null }
    },

    setImportMode(mode) {
        this.importState.mode = mode;
        const singleMode = document.getElementById('import-single-mode');
        const multiMode = document.getElementById('import-multi-mode');
        const btnSingle = document.getElementById('import-mode-single');
        const btnMulti = document.getElementById('import-mode-multi');

        if (mode === 'single') {
            singleMode.classList.remove('hidden');
            multiMode.classList.add('hidden');
            btnSingle.classList.add('bg-white', 'shadow', 'text-teal-700');
            btnSingle.classList.remove('text-slate-600');
            btnMulti.classList.remove('bg-white', 'shadow', 'text-teal-700');
            btnMulti.classList.add('text-slate-600');
        } else {
            singleMode.classList.add('hidden');
            multiMode.classList.remove('hidden');
            btnMulti.classList.add('bg-white', 'shadow', 'text-teal-700');
            btnMulti.classList.remove('text-slate-600');
            btnSingle.classList.remove('bg-white', 'shadow', 'text-teal-700');
            btnSingle.classList.add('text-slate-600');
        }
        // Reset state
        this.importState.sheets = { processos: null, esteiras: null, tarefas: null };
        this.importState.files = { processos: null, esteiras: null, tarefas: null };
        document.getElementById('btn-confirm-import').disabled = true;
    },

    // Single file mode - detect multi-sheet Excel
    onFileSelect(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        const btn = document.getElementById('btn-confirm-import');
        const statusDiv = document.getElementById('import-sheets-status');
        const msgDiv = document.getElementById('import-messages');

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                this.importState.workbook = workbook;

                // Detect sheets by name patterns
                const sheetNames = workbook.SheetNames;
                const findSheet = (patterns) => sheetNames.find(s =>
                    patterns.some(p => s.toLowerCase().includes(p.toLowerCase()))
                );

                const processosSheet = findSheet(['processo', 'PROCESSOS', 'processos_analitico']);
                const esteirasSheet = findSheet(['esteira', 'ESTEIRAS', 'esteiras_analitico']);
                const tarefasSheet = findSheet(['tarefa', 'fato', 'TAREFAS', 'tarefas_fato']);

                // Parse found sheets
                if (processosSheet) {
                    this.importState.sheets.processos = XLSX.utils.sheet_to_json(workbook.Sheets[processosSheet]);
                }
                if (esteirasSheet) {
                    this.importState.sheets.esteiras = XLSX.utils.sheet_to_json(workbook.Sheets[esteirasSheet]);
                }
                if (tarefasSheet) {
                    this.importState.sheets.tarefas = XLSX.utils.sheet_to_json(workbook.Sheets[tarefasSheet]);
                }

                // Update UI indicators
                statusDiv.classList.remove('hidden');
                this.updateSheetIndicator('processos', processosSheet, this.importState.sheets.processos);
                this.updateSheetIndicator('esteiras', esteirasSheet, this.importState.sheets.esteiras);
                this.updateSheetIndicator('tarefas', tarefasSheet, this.importState.sheets.tarefas);

                // Validate minimum requirements (processos + tarefas)
                const hasProcessos = !!this.importState.sheets.processos?.length;
                const hasTarefas = !!this.importState.sheets.tarefas?.length;

                if (hasProcessos || hasTarefas) {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    msgDiv.classList.add('hidden');
                } else {
                    // Fallback: try legacy single-sheet mode
                    const firstSheet = workbook.Sheets[sheetNames[0]];
                    const legacyData = XLSX.utils.sheet_to_json(firstSheet);
                    if (legacyData.length > 0) {
                        this.importState.sheets.tarefas = legacyData;
                        this.importState.sheets._legacyMode = true;
                        msgDiv.classList.remove('hidden');
                        msgDiv.className = 'mt-4 p-3 rounded-lg text-sm bg-amber-50 text-amber-800';
                        msgDiv.innerHTML = '<i class="fa-solid fa-exclamation-triangle mr-2"></i>Modo legado: arquivo único detectado.';
                        btn.disabled = false;
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
            } catch (error) {
                console.error('Erro ao processar arquivo:', error);
                msgDiv.classList.remove('hidden');
                msgDiv.className = 'mt-4 p-3 rounded-lg text-sm bg-red-50 text-red-700';
                msgDiv.innerHTML = `<i class="fa-solid fa-xmark mr-2"></i>Erro: ${error.message}`;
            }
        };
        reader.readAsArrayBuffer(file);
    },

    updateSheetIndicator(type, sheetName, data) {
        const row = document.getElementById(`sheet-${type}`);
        const countEl = document.getElementById(`sheet-${type}-count`);
        const icon = row.querySelector('i');

        if (sheetName && data?.length) {
            row.classList.add('bg-green-50');
            row.classList.remove('bg-slate-50');
            icon.className = 'fa-solid fa-circle-check text-green-500';
            countEl.textContent = `${data.length} registros`;
            countEl.className = 'ml-auto text-xs text-green-600 font-medium';
        } else {
            row.classList.remove('bg-green-50');
            row.classList.add('bg-slate-50');
            icon.className = 'fa-solid fa-circle-xmark text-slate-300';
            countEl.textContent = 'não encontrada';
            countEl.className = 'ml-auto text-xs text-slate-400';
        }
    },

    // Multi-file mode handler
    onMultiFileSelect(type, input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                this.importState.files[type] = XLSX.utils.sheet_to_json(firstSheet);

                // Check if we have enough files to proceed
                const hasProcessos = !!this.importState.files.processos?.length;
                const hasTarefas = !!this.importState.files.tarefas?.length;
                const btn = document.getElementById('btn-confirm-import');

                if (hasProcessos && hasTarefas) {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            } catch (error) {
                console.error(`Erro ao processar ${type}:`, error);
                this.showToast(`Erro ao ler ${type}`, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    confirmImport() {
        let processosData, esteirasData, tarefasData;

        if (this.importState.mode === 'single') {
            processosData = this.importState.sheets.processos;
            esteirasData = this.importState.sheets.esteiras;
            tarefasData = this.importState.sheets.tarefas;

            // Legacy mode fallback
            if (this.importState.sheets._legacyMode) {
                this.state.data = this.processImportedData(tarefasData);
                this.saveData();
                this.populateFilters();
                this.closeModals();
                this.render();
                this.showToast('Dados importados (modo legado)', 'success');
                return;
            }
        } else {
            processosData = this.importState.files.processos;
            esteirasData = this.importState.files.esteiras;
            tarefasData = this.importState.files.tarefas;
        }

        // Execute ETL pipeline
        const result = this.executeETL(processosData, esteirasData, tarefasData);

        if (result.success) {
            this.state.data = result.data;
            this.state.importErrors = result.orphans;
            this.saveData();
            this.populateFilters();
            this.closeModals();
            this.render();

            const orphanMsg = result.orphans.length > 0
                ? ` (${result.orphans.length} registros órfãos)`
                : '';
            this.showToast(`Importados: ${result.stats.processos} processos, ${result.stats.tarefas} tarefas${orphanMsg}`, 'success');
        } else {
            this.showToast('Erro na importação: ' + result.error, 'error');
        }
    },

    // ============================================================
    // 5.2. ETL PIPELINE
    // ============================================================

    executeETL(processosRaw, esteirasRaw, tarefasRaw) {
        try {
            // Step 1: Process PROCESSOS (create operation skeletons)
            const operationsMap = this.processProcessos(processosRaw || []);

            // Step 2: Process ESTEIRAS (create track groups)
            const tracksMap = this.processEsteiras(esteirasRaw || [], operationsMap);

            // Step 3: Process TAREFAS (with orphan handling)
            const { tasks, orphans } = this.processTarefas(tarefasRaw || [], operationsMap);

            // Step 4: Build final hierarchical structure
            const finalData = this.buildFinalDataStructure(operationsMap, tracksMap, tasks, orphans);

            return {
                success: true,
                data: finalData,
                orphans: orphans,
                stats: {
                    processos: Object.keys(operationsMap).length,
                    esteiras: Object.values(tracksMap).flat().length,
                    tarefas: tasks.length,
                    orphans: orphans.length
                }
            };
        } catch (error) {
            console.error('ETL Error:', error);
            return { success: false, error: error.message };
        }
    },

    // Process PROCESSOS sheet → base operations
    processProcessos(rawData) {
        const map = {};
        rawData.forEach((row, idx) => {
            const n = this.normalizeKeys(row);
            const processId = n.process_id || n.id || `PROC-${idx}`;

            // Parse servicos as array (comma-separated → array)
            const servicosRaw = n.servicos_contratados || n.servicos || '';
            const servicosArray = typeof servicosRaw === 'string'
                ? servicosRaw.split(',').map(s => s.trim()).filter(s => s.length > 0)
                : Array.isArray(servicosRaw) ? servicosRaw : [];

            map[processId] = {
                process_id: processId,
                razao_social_cliente: n.razao_social_cliente || n.cliente || 'Cliente Desconhecido',
                razao_social_da_spe: n.razao_social_da_spe || n.spe || n.razao_social_cliente || 'SPE Desconhecida',
                cnpj_da_spe: n.cnpj_da_spe || n.cnpj || '',
                fase_da_spe: n.fase_da_spe || n.fase || 'Não definida',
                status_jornada_cliente: n.status_jornada_cliente || n.status_jornada || 'Em Andamento',
                erp: n.erp || '',
                codigo_uau: parseInt(n.codigo_uau) || null,
                servicos_contratados: servicosArray, // Now an array!

                // Milestone dates (TtV)
                data_inicio_contrato: this.parseExcelDate(n.data_inicio_contrato),
                data_kick_off_cliente: this.parseExcelDate(n.data_kick_off_cliente || n.data_kick_off),
                data_handover_comercial: this.parseExcelDate(n.data_handover_comercial || n.handover),
                data_apresentacao_viabilidade: this.parseExcelDate(n.data_apresentacao_viabilidade || n.data_viabilidade),
                data_inicio_financeira: this.parseExcelDate(n.data_inicio_financeira || n.data_financeira),
                data_inicio_carteira: this.parseExcelDate(n.data_inicio_carteira || n.data_carteira),
                kpi_ttv_dias_corridos: parseInt(n.kpi_ttv_dias_corridos) || 0,

                // Flags
                is_ativo_financeiro: this.parseBool(n.is_ativo_financeiro),
                is_ativo_carteira: this.parseBool(n.is_ativo_carteira),

                // Containers for related data
                esteiras: [],
                tasks: []
            };
        });
        return map;
    },

    // Process ESTEIRAS sheet → track groups
    processEsteiras(rawData, operationsMap) {
        const tracksMap = {}; // process_id -> [esteiras]
        const today = new Date().toISOString().split('T')[0];

        rawData.forEach((row, idx) => {
            const n = this.normalizeKeys(row);
            const processId = n.process_id || '';
            const esteiraName = n.esteira || n.nome || n.nome_esteira || 'Geral';
            const dataPrevisao = this.parseExcelDate(n.data_previsao_entrega);
            const dataConclusao = this.parseExcelDate(n.data_conclusao);
            const slaDias = parseInt(n.sla_esteira_dias || n.sla_total || n.sla) || null;

            // Calculate esteira status based on SLA
            let statusEsteira = n.status_esteira_detalhado || n.status_esteira || 'Em Andamento';
            const isCompleted = dataConclusao !== null;
            const isOverdue = !isCompleted && dataPrevisao && today > dataPrevisao;

            const track = {
                esteira_id: n.esteira_id || `EST-${idx}`,
                process_id: processId,
                esteira: esteiraName,
                status_esteira_detalhado: statusEsteira,
                sla_esteira_dias: slaDias, // SLA in days for this track
                data_previsao_entrega: dataPrevisao,
                data_conclusao: dataConclusao,
                is_completed: isCompleted,
                is_overdue: isOverdue,
                tasks: []
            };

            if (!tracksMap[processId]) {
                tracksMap[processId] = [];
            }
            tracksMap[processId].push(track);

            // Also add to operation if exists
            if (operationsMap[processId]) {
                operationsMap[processId].esteiras.push(track);
            }
        });

        return tracksMap;
    },

    // Process TAREFAS sheet → detail items with orphan handling
    processTarefas(rawData, operationsMap) {
        const tasks = [];
        const orphans = [];
        const today = new Date().toISOString().split('T')[0];

        rawData.forEach((row, idx) => {
            const n = this.normalizeKeys(row);
            const processId = n.process_id || '';

            const criacao = this.parseExcelDate(n.criacao_tarefa || n.criacao);
            const conclusao = this.parseExcelDate(n.conclusao_tarefa || n.conclusao);
            const slaDias = parseInt(n.sla_dias_uteis_padrao || n.sla) || 5;
            const prazoSLA = this.parseExcelDate(n.data_prazo_sla || n.prazo) || (criacao ? WorkingHoursEngine.addWorkingDays(criacao, slaDias) : null);
            const statusReal = n.status_real || n.status || 'Aberta';
            const isConcluded = statusReal.toLowerCase().includes('conclu');
            const comentario = n.comentario_resolucao_pendencia || n.comentario || '';

            const task = {
                task_id: n.task_id || n.id || `TASK-${idx}`,
                process_id: processId,
                esteira: n.esteira || 'Geral',
                nome_tarefa: n.nome_tarefa || n.tarefa || 'Tarefa sem nome',
                classificacao_tarefa: n.classificacao_tarefa || '',
                responsabilidade: n.responsabilidade || n.responsavel || 'Não atribuído',
                status_real: statusReal,
                status_sla: n.status_sla || '',
                status_esteira_detalhado: n.status_esteira_detalhado || '',
                sla_dias_uteis_padrao: slaDias,
                criacao_tarefa: criacao,
                data_prazo_sla: prazoSLA,
                conclusao_tarefa: conclusao,
                nome_pendencia_ativa: n.nome_pendencia_ativa || '',
                comentario_resolucao_pendencia: comentario,

                // Computed properties
                is_delayed: !isConcluded && prazoSLA && today > prazoSLA,
                lead_time: conclusao ? WorkingHoursEngine.calcBusinessDays(criacao, conclusao) : null,
                aging_bucket: !isConcluded ? WorkingHoursEngine.getAgingBucket(criacao) : null,
                causa_raiz: WorkingHoursEngine.classifyCausaRaiz(comentario),
                is_done: isConcluded
            };

            // Check if parent exists
            if (operationsMap[processId]) {
                // Get parent info for task - copy ALL relevant fields
                const parent = operationsMap[processId];
                task.razao_social_cliente = parent.razao_social_cliente;
                task.razao_social_da_spe = parent.razao_social_da_spe;
                task.cnpj_da_spe = parent.cnpj_da_spe;
                task.fase_da_spe = parent.fase_da_spe;
                task.erp = parent.erp;
                task.codigo_uau = parent.codigo_uau;
                task.servicos_contratados = parent.servicos_contratados;
                task.status_jornada_cliente = parent.status_jornada_cliente;
                task.status_global_processo = parent.status_jornada_cliente; // Alias for global status

                // Milestone dates
                task.data_inicio_contrato = parent.data_inicio_contrato;
                task.data_kick_off = parent.data_kick_off_cliente;
                task.data_kick_off_cliente = parent.data_kick_off_cliente;
                task.data_handover_comercial = parent.data_handover_comercial;
                task.data_apresentacao_viabilidade = parent.data_apresentacao_viabilidade;
                task.data_inicio_financeira = parent.data_inicio_financeira;
                task.data_inicio_carteira = parent.data_inicio_carteira;
                task.kpi_ttv_dias_corridos = parent.kpi_ttv_dias_corridos;
                task.is_ativo_financeiro = parent.is_ativo_financeiro;
                task.is_ativo_carteira = parent.is_ativo_carteira;

                tasks.push(task);
                operationsMap[processId].tasks.push(task);
            } else if (processId) {
                // Orphan: process_id not found
                task._orphan = true;
                task._missingProcessId = processId;
                orphans.push(task);
            } else {
                // No process_id at all - treat as standalone
                task.razao_social_cliente = 'Sem Cliente';
                task.razao_social_da_spe = 'Sem SPE';
                tasks.push(task);
            }
        });

        return { tasks, orphans };
    },

    // Build final flat array maintaining hierarchy info
    buildFinalDataStructure(operationsMap, tracksMap, tasks, orphans) {
        const result = [];

        // Add all valid tasks (they already have parent info from processTarefas)
        result.push(...tasks);

        // Handle orphans: create placeholder operations
        if (orphans.length > 0) {
            const orphansByProcess = orphans.reduce((acc, t) => {
                const pid = t._missingProcessId || 'UNKNOWN';
                if (!acc[pid]) acc[pid] = [];
                acc[pid].push(t);
                return acc;
            }, {});

            Object.entries(orphansByProcess).forEach(([pid, orphanTasks]) => {
                orphanTasks.forEach(t => {
                    t.razao_social_cliente = '[ÓRFÃO] ' + pid;
                    t.razao_social_da_spe = '[DADOS INCOMPLETOS]';
                    result.push(t);
                });
            });
        }

        return result;
    },

    // Helper: Normalize object keys
    normalizeKeys(row) {
        const n = {};
        Object.keys(row).forEach(k => {
            n[k.toLowerCase().trim().replace(/\s+/g, '_')] = row[k];
        });
        return n;
    },

    // Helper: Parse boolean from various formats
    parseBool(val) {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
            const v = val.toLowerCase().trim();
            return v === 'true' || v === 'sim' || v === '1' || v === 'yes';
        }
        return !!val;
    },

    // ============================================================
    // 6. HELPER FUNCTIONS & UI ACTIONS
    // ============================================================

    toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); },
    toggleAccordion(id) {
        this.state.expandedItems[id] = !this.state.expandedItems[id];
        this.renderDashboard(document.getElementById('app-content'));
    },

    // Navegação
    setView(view) {
        this.state.currentView = view;
        this.render();
    },
    navMonth(dir) {
        this.state.currentMonth.setMonth(this.state.currentMonth.getMonth() + dir);
        this.render();
    },

    // Filtros
    populateFilters() {
        // Client filter
        const clientSelect = document.getElementById('client-filter');
        const clients = [...new Set(this.state.data.map(d => d.razao_social_cliente))].sort();
        clientSelect.innerHTML = '<option value="">Todos os Clientes</option>' + clients.map(c => `<option value="${c}">${c}</option>`).join('');

        // Service filter - extract unique services from all operations
        const serviceSelect = document.getElementById('service-filter');
        if (serviceSelect) {
            const allServices = this.extractUniqueServices();
            serviceSelect.innerHTML = '<option value="">Todos os Serviços</option>' +
                allServices.map(s => `<option value="${s}">${s}</option>`).join('');
        }
    },

    // Extract unique services from all data
    extractUniqueServices() {
        const servicesSet = new Set();
        this.state.data.forEach(item => {
            const servicos = item.servicos_contratados;
            if (Array.isArray(servicos)) {
                servicos.forEach(s => servicesSet.add(s));
            } else if (typeof servicos === 'string' && servicos) {
                servicos.split(',').forEach(s => servicesSet.add(s.trim()));
            }
        });
        return [...servicesSet].sort();
    },

    onClientFilterChange(val) {
        this.state.filterClient = val;
        this.render();
    },

    onServiceFilterChange(val) {
        this.state.filterService = val;
        this.render();
    },

    renderSidebar() {
        const menu = document.getElementById('sidebar-menu-main');
        menu.innerHTML = `
            <li class="sidebar-section">PRINCIPAL</li>
            <li id="menu-carteira" class="sidebar-menu-item active" onclick="App.setView('carteira')">
                <i class="fa-solid fa-briefcase"></i> <span>Carteira</span>
            </li>
            <li id="menu-calendario" class="sidebar-menu-item" onclick="App.setView('calendario')">
                <i class="fa-solid fa-calendar-days"></i> <span>Calendário</span>
            </li>
            <li id="menu-daily" class="sidebar-menu-item" onclick="App.setView('daily')">
                <i class="fa-solid fa-clipboard-check"></i> <span>Daily Operacional</span>
            </li>
            
            <li class="sidebar-section">RELATÓRIOS</li>
            <li id="menu-overview" class="sidebar-menu-item" onclick="App.setView('overview')">
                <i class="fa-solid fa-chart-pie"></i> <span>Visão Geral</span>
            </li>
            <li id="menu-esteiras" class="sidebar-menu-item" onclick="App.setView('esteiras')">
                <i class="fa-solid fa-stream"></i> <span>Esteiras</span>
            </li>
            <li id="menu-sla" class="sidebar-menu-item" onclick="App.setView('sla')">
                <i class="fa-solid fa-clock"></i> <span>SLA & Tempo</span>
            </li>
            <li id="menu-pendencias" class="sidebar-menu-item" onclick="App.setView('pendencias')">
                <i class="fa-solid fa-exclamation-triangle"></i> <span>Pendências</span>
            </li>
        `;
    },

    renderStats() {
        const data = this.getFilteredData();
        const clients = [...new Set(data.map(d => d.razao_social_cliente))].length;
        const spes = [...new Set(data.map(d => d.razao_social_da_spe))].length;

        // Calculate health status based on global status of SPEs
        const speStatusMap = {};
        data.forEach(d => {
            const spe = d.razao_social_da_spe;
            if (!speStatusMap[spe]) {
                const status = (d.status_global_processo || '').toLowerCase();
                speStatusMap[spe] = status;
            }
        });

        const delayedSpes = Object.values(speStatusMap).filter(s => s.includes('risco') || s.includes('atras')).length;

        document.getElementById('stats-bar-container').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon text-indigo-400"><i class="fa-solid fa-users"></i></div>
                <div class="stat-content"><span class="stat-value">${clients}</span><span class="stat-label">Clientes</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon text-purple-400"><i class="fa-solid fa-building"></i></div>
                <div class="stat-content"><span class="stat-value">${spes}</span><span class="stat-label">Empresas (SPEs)</span></div>
            </div>
            ${delayedSpes > 0 ? `
            <div class="stat-card">
                <div class="stat-icon text-amber-400"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="stat-content"><span class="stat-value">${delayedSpes}</span><span class="stat-label">SPEs em Risco</span></div>
            </div>
            ` : ''}
        `;
    },

    // --- Modal Logic ---
    openImportModal() {
        document.getElementById('modal-import').classList.remove('hidden');
        document.getElementById('modal-import').classList.add('flex');
    },

    // Anotações
    openAnnotationModal(dateStr) {
        this.state.activeDate = dateStr;
        document.getElementById('annotationDateLabel').innerText = WorkingHoursEngine.formatDate(dateStr);
        document.getElementById('generalAnnotation').value = this.state.annotations[dateStr] || '';
        document.getElementById('annotationModal').classList.remove('hidden');
        document.getElementById('annotationModal').classList.add('flex');
    },
    saveAnnotation() {
        const val = document.getElementById('generalAnnotation').value;
        if (this.state.activeDate) {
            this.state.annotations[this.state.activeDate] = val;
            this.saveData();
            this.closeModals();
        }
    },

    // Eventos
    openEventModal(dateStr, eventIndex = null) {
        this.state.activeDate = dateStr;
        this.state.editingEventIndex = eventIndex;

        const modal = document.getElementById('eventModal');
        const titleEl = document.getElementById('eventModalTitle');
        const deleteBtn = document.getElementById('btnDeleteEvent');

        document.getElementById('eventDate').value = dateStr;

        if (eventIndex !== null && this.state.events[dateStr]?.[eventIndex]) {
            const evt = this.state.events[dateStr][eventIndex];
            document.getElementById('eventTitle').value = evt.title;
            document.getElementById('eventType').value = evt.type;
            titleEl.textContent = 'Editar Evento';
            deleteBtn.classList.remove('hidden');
        } else {
            document.getElementById('eventTitle').value = '';
            document.getElementById('eventType').value = 'MEETING';
            titleEl.textContent = 'Novo Evento';
            deleteBtn.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    saveEvent() {
        const title = document.getElementById('eventTitle').value;
        const date = document.getElementById('eventDate').value;
        if (!title || !date) {
            this.showToast('Preencha título e data', 'warning');
            return;
        }

        if (!this.state.events[date]) this.state.events[date] = [];

        const eventData = { title, type: document.getElementById('eventType').value };

        if (this.state.editingEventIndex !== null) {
            this.state.events[date][this.state.editingEventIndex] = eventData;
        } else {
            this.state.events[date].push(eventData);
        }

        this.state.editingEventIndex = null;
        this.saveData();
        this.closeModals();
    },

    deleteEvent() {
        const date = this.state.activeDate;
        const index = this.state.editingEventIndex;

        if (date && index !== null && this.state.events[date]?.[index]) {
            this.state.events[date].splice(index, 1);
            if (this.state.events[date].length === 0) {
                delete this.state.events[date];
            }
            this.state.editingEventIndex = null;
            this.saveData();
            this.closeModals();
            this.showToast('Evento excluído', 'success');
        }
    },

    closeModals() {
        document.querySelectorAll('.fixed').forEach(el => { el.classList.add('hidden'); el.classList.remove('flex'); });
    },

    resetToDefaultData() {
        if (confirm('Tem certeza? Isso apagará todas as importações.')) {
            localStorage.removeItem('trinus_data');
            this.loadData();
            this.render();
            this.showToast('Base resetada com sucesso', 'success');
        }
    },

    // Toast notification system
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-500',
            warning: 'bg-amber-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };
        toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg z-[200] fade-in`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // HTML escape helpers
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeAttr(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    },

    getEsteiraColor(name) {
        const map = { 'Viabilidade': '#3b82f6', 'Jurídico': '#8b5cf6', 'Financeiro': '#10b981', 'Engenharia': '#f59e0b', 'Fiscal': '#ef4444' };
        return map[name] || '#64748b';
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());