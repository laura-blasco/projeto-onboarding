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
        activeTab: 'diario', // Aba ativa na visão Operação (diario, cronograma, cadastro)
        filterPendenciasSpe: '', // Filtro local para Pendências
        filterPendenciasEsteira: '', // Filtro local para Pendências
        filterPendenciasResponsavel: '', // Novo filtro por responsável nas pendências
        filterPendenciasArea: '', // Novo filtro por área nas pendências
        filterKeyAccount: '', // Novo filtro de KA
        chartInstances: {
            erpChart: null,
            faseChart: null,
            tipologiaChart: null,
            statusChart: null,
            phasesChart: null,
            slaChart: null
        },
        overviewFilter: 'all', // Default filter for Overview dashboard
        operacionalSubView: 'lancamentos', // Sub-view for Gestão Operacional
        processualSubView: 'esteiras', // Sub-view for Gestão Processual
        filterDailyStatuses: ['risk', 'attention', 'ok'], // Default filters for Daily (excluding 'healthy')
        filterExecutiveERP: '', // Filtro secundário por ERP no Dashboard
        filterExecutiveFase: '', // Filtro secundário por Fase no Dashboard
        filterExecutiveTipologia: '' // Filtro secundário por Tipologia no Dashboard
    },

    // Mapa de títulos para breadcrumb
    viewTitles: {
        'carteira': 'Acompanhamento Geral',
        'operacao': 'Operação',
        'overview': 'Visão Geral',
        'gestao-operacional': 'Gestão Operacional',
        'gestao-processual': 'Gestão Processual',
        'pendencias': 'Pendências',
        'calendario': 'Gestão de Projetos',
        'daily-history': 'Histórico de Registros',
        'faturamento': 'Gestão de Faturamento',
        'entregaveis': 'Gestão de Entregáveis'
    },

    // Definição das Esteiras (Project Tracks)
    esteirasConfig: {
        'viabilidade': { label: 'Viabilidade', sla: 5, color: 'bg-blue-500', icon: 'fa-check-circle' },
        'juridico': { label: 'Jurídico', sla: 10, color: 'bg-purple-500', icon: 'fa-gavel' },
        'financeiro': { label: 'Financeiro', sla: 7, color: 'bg-emerald-500', icon: 'fa-dollar-sign' },
        'engenharia': { label: 'Engenharia', sla: 15, color: 'bg-amber-500', icon: 'fa-hard-hat' },
        'comercial': { label: 'Comercial', sla: 5, color: 'bg-indigo-500', icon: 'fa-handshake' },
        'carteira': { label: 'Carteira', sla: 3, color: 'bg-teal-500', icon: 'fa-briefcase' }
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
            tipologia_spe: "Vertical",
            servicos_contratados: "Onboarding Completo",
            sla_dias_uteis_padrao: 5,
            process_id: "PROC-001",
            task_id: "TASK-001",
            nome_tarefa: "Análise de Viabilidade Técnica",
            classificacao_tarefa: "Técnica",
            responsabilidade: "Equipe Engenharia",
            responsavel_direto_tags: "Engenharia",
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
            data_inicio_carteira: null,
            sonar_business_id: "B-123",
            sonar_project_id: "P-456",
            id_azo_ativo: "AZO-001",
            id_azo_operacao: "OP-001",
            nome_do_key_account: "João Silva",
            gerente_comercial: "Maria Oliveira",
            origem: "Indicação",
            prazo_da_politica_de_pagamentos: "30 dias",
            link_pasta: "https://sharepoint.com/spe1",
            grupo_cliente: "Diamante",
            // NEW: Critical Data for Gantt - Source of Truth
            esteiras_analitico: [
                {
                    identificacao: "ID-001",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Viabilidade",
                    esteira: "Viabilidade",
                    status_esteira_detalhado: "Concluído",
                    detalhe_situacao: "Aprovado com ressalvas",
                    comentario_pendencia: null,
                    data_inicio: "2026-01-15",
                    data_previsao_entrega: "2026-01-20",
                    data_conclusao: "2026-01-18",
                    sla_esteira_dias: 5
                },
                {
                    identificacao: "ID-002",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Jurídico",
                    esteira: "Jurídico",
                    status_esteira_detalhado: "Em Andamento",
                    detalhe_situacao: "Análise contratual",
                    comentario_pendencia: "Aguardando retorno do cliente",
                    data_inicio: "2026-01-19",
                    data_previsao_entrega: "2026-02-05",
                    data_conclusao: null,
                    sla_esteira_dias: 10
                },
                {
                    identificacao: "ID-003",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Financeiro",
                    esteira: "Financeiro",
                    status_esteira_detalhado: "Pendente",
                    detalhe_situacao: "Aguardando documentação",
                    comentario_pendencia: null,
                    data_inicio: null,
                    data_previsao_entrega: "2026-02-10",
                    data_conclusao: null,
                    sla_esteira_dias: 7
                },
                {
                    identificacao: "ID-004",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Carteira",
                    esteira: "Carteira",
                    status_esteira_detalhado: "Bloqueado",
                    detalhe_situacao: "Dependência de Financeiro",
                    comentario_pendencia: null,
                    data_inicio: null,
                    data_previsao_entrega: null,
                    data_conclusao: null,
                    sla_esteira_dias: 15
                }
            ]
        },
        {
            id: "2",
            razao_social_cliente: "DEMO CONSTRUTORA LTDA",
            razao_social_da_spe: "SPE Residencial Jardins",
            cnpj_da_spe: "12.345.678/0001-90",
            erp: "SAP",
            codigo_uau: 1001,
            fase_da_spe: "Implantação",
            tipologia_spe: "Vertical",
            servicos_contratados: "Onboarding Completo, Fiscal",
            sla_dias_uteis_padrao: 10,
            process_id: "PROC-001",
            task_id: "TASK-002",
            nome_tarefa: "Elaboração de Minuta Contratual",
            classificacao_tarefa: "Jurídica",
            responsabilidade: "Equipe Jurídico",
            responsavel_direto_tags: "Jurídico",
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
            data_inicio_carteira: null,
            sonar_business_id: "B-123",
            sonar_project_id: "P-456",
            id_azo_ativo: "AZO-001",
            id_azo_operacao: "OP-001",
            nome_do_key_account: "João Silva",
            gerente_comercial: "Maria Oliveira",
            origem: "Indicação",
            prazo_da_politica_de_pagamentos: "30 dias",
            link_pasta: "https://sharepoint.com/spe1",
            grupo_cliente: "Diamante",
            esteiras_analitico: [
                {
                    identificacao: "ID-005",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Viabilidade",
                    esteira: "Viabilidade",
                    status_esteira_detalhado: "Concluído",
                    detalhe_situacao: "Aprovado",
                    comentario_pendencia: null,
                    data_inicio: "2026-01-10",
                    data_previsao_entrega: "2026-01-15",
                    data_conclusao: "2026-01-14",
                    sla_esteira_dias: 5
                },
                {
                    identificacao: "ID-006",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Jurídico",
                    esteira: "Jurídico",
                    status_esteira_detalhado: "Concluído",
                    detalhe_situacao: "Minuta Aprovada",
                    comentario_pendencia: null,
                    data_inicio: "2026-01-15",
                    data_previsao_entrega: "2026-01-25",
                    data_conclusao: "2026-01-24",
                    sla_esteira_dias: 10
                },
                {
                    identificacao: "ID-007",
                    nome_processo: "Onboarding Jardin",
                    process_id: "PROC-001",
                    razao_social_cliente: "DEMO CONSTRUTORA LTDA",
                    razao_social_da_spe: "SPE Residencial Jardins",
                    fase_da_spe: "Implantação",
                    erp: "SAP",
                    status_global_processo: "Em Andamento",
                    etapa: "Financeiro",
                    esteira: "Financeiro",
                    status_esteira_detalhado: "Em Andamento",
                    detalhe_situacao: "Coletando assinaturas",
                    comentario_pendencia: null,
                    data_inicio: "2026-01-25",
                    data_previsao_entrega: "2026-02-15",
                    data_conclusao: null,
                    sla_esteira_dias: 7
                }
            ]
        },
        {
            id: "3",
            razao_social_cliente: "DEMO CONSTRUTORA LTDA",
            razao_social_da_spe: "SPE Comercial Centro",
            cnpj_da_spe: "12.345.678/0002-71",
            erp: "SAP",
            codigo_uau: 1002,
            fase_da_spe: "Pré-Operação",
            tipologia_spe: "Horizontal",
            servicos_contratados: "Financeiro, Fiscal, Contábil",
            sla_dias_uteis_padrao: 15,
            process_id: "PROC-002",
            task_id: "TASK-003",
            nome_tarefa: "Setup de Contas Bancárias",
            classificacao_tarefa: "Financeira",
            responsabilidade: "Equipe Financeiro",
            responsavel_direto_tags: "Financeiro",
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
            data_inicio_carteira: null,
            sonar_business_id: "B-777",
            sonar_project_id: "P-888",
            id_azo_ativo: "AZO-002",
            id_azo_operacao: "OP-002",
            nome_do_key_account: "Ricardo Souza",
            gerente_comercial: "Ana Santos",
            origem: "Direto",
            prazo_da_politica_de_pagamentos: "45 dias",
            link_pasta: "https://sharepoint.com/spe2",
            grupo_cliente: "Ouro"
        },
        {
            id: "4",
            razao_social_cliente: "BETA INCORPORADORA SA",
            razao_social_da_spe: "SPE Loteamento Jardins",
            cnpj_da_spe: "98.765.432/0001-10",
            erp: "TOTVS",
            codigo_uau: 2001,
            fase_da_spe: "Implantação",
            tipologia_spe: "Loteamento",
            servicos_contratados: "Onboarding Completo",
            sla_dias_uteis_padrao: 20,
            process_id: "PROC-003",
            task_id: "TASK-004",
            nome_tarefa: "Projeto Arquitetônico",
            classificacao_tarefa: "Técnica",
            responsabilidade: "Equipe Engenharia",
            responsavel_direto_tags: "Engenharia",
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
            data_inicio_carteira: "2026-02-01",
            sonar_business_id: "B-999",
            sonar_project_id: "P-000",
            id_azo_ativo: "AZO-003",
            id_azo_operacao: "OP-003",
            nome_do_key_account: "Ricardo Souza",
            gerente_comercial: "Ana Santos",
            origem: "Parceiro",
            prazo_da_politica_de_pagamentos: "15 dias",
            link_pasta: "https://sharepoint.com/spe3",
            grupo_cliente: "Prata"
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
            if (m.key === 'data_inicio_viabilidade') {
                const hasService = services.some(s =>
                    s.toLowerCase().includes('viabilidade') ||
                    s.toLowerCase().includes('estudo')
                );
                return hasService || spe.data_inicio_viabilidade;
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

        // Primary: Use status_jornada_cliente if it has the standard numbering or names
        const jornada = (speData[0]?.status_jornada_cliente || '').toLowerCase();
        const pendingCount = speData.filter(t => !t.is_done).length;

        if (jornada.includes('5. conclu') || jornada.includes('finaliz')) {
            return { status: 'healthy', label: 'Concluído', color: 'green', pendingCount: 0 };
        }
        if (jornada.includes('bloq') || jornada.includes('parado') || jornada.includes('suspen') || jornada.includes('4.')) {
            return { status: 'risk', label: 'Bloqueado', color: 'red', pendingCount };
        }
        if (jornada.includes('3. atras') || jornada.includes('risco') || jornada.includes('atraso') || jornada.includes('2.')) {
            return { status: 'attention', label: 'Atraso / Risco', color: 'amber', pendingCount };
        }
        if (jornada.includes('andamento') || jornada.includes('progress') || jornada.includes('ativo') || jornada.includes('1.')) {
            return { status: 'ok', label: 'Em Andamento', color: 'teal', pendingCount };
        }

        // Secondary: Union with status_global_processo
        const globalStatus = (speData[0]?.status_global_processo || '').toLowerCase();
        if (globalStatus.includes('5. conclu') || globalStatus.includes('finaliz')) {
            return { status: 'healthy', label: 'Concluído', color: 'green', pendingCount: 0 };
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
                    servicos_contratados: task.servicos_contratados,
                    esteiras_analitico: task.esteiras_analitico || [], // Bubble up analytical data
                    tasks: []
                };
            } else if (task.esteiras_analitico && task.esteiras_analitico.length > 0) {
                // If another task has the analytical data, merge it (prioritizing existing if not empty)
                if (grouped[clientName].spes[speName].esteiras_analitico.length === 0) {
                    grouped[clientName].spes[speName].esteiras_analitico = task.esteiras_analitico;
                }
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

    groupBySPE(data) {
        const map = {};
        data.forEach(t => {
            const spe = t.razao_social_da_spe || 'N/A';
            if (!map[spe]) {
                map[spe] = {
                    name: spe,
                    razao_social_cliente: t.razao_social_cliente,
                    status_jornada_cliente: t.status_jornada_cliente,
                    fase_da_spe: t.fase_da_spe,
                    tipologia_spe: t.tipologia_spe,
                    erp: t.erp,
                    sonar_business_id: t.sonar_business_id,
                    sonar_project_id: t.sonar_project_id,
                    id_azo_ativo: t.id_azo_ativo,
                    id_azo_operacao: t.id_azo_operacao,
                    nome_do_key_account: t.nome_do_key_account,
                    gerente_comercial: t.gerente_comercial,
                    origem: t.origem,
                    prazo_da_politica_de_pagamentos: t.prazo_da_politica_de_pagamentos,
                    link_pasta: t.link_pasta,
                    codigo_uau: t.codigo_uau,
                    process_id: t.process_id,
                    start: t.data_kick_off || t.data_inicio_jornada || t.criacao_tarefa,
                    end: t.data_conclusao || t.data_previsao_entrega || t.data_prazo_sla,
                    kpi_ttv_dias_corridos: t.kpi_ttv_dias_corridos,
                    servicos_contratados: t.servicos_contratados,
                    sla_dias_uteis_padrao: t.sla_dias_uteis_padrao,
                    tasks: []
                };
            }
            map[spe].tasks.push(t);
        });

        // Post-process statuses
        Object.values(map).forEach(spe => {
            spe.healthStatus = this.getSpeStatus(spe.tasks);
        });

        return map;
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
            case 'company':
                this.renderOperacao(container);
                break;
            case 'overview':
                this.renderOverview(container);
                break;
            case 'gestao-operacional':
                this.renderGestaoOperacional(container);
                break;
            case 'gestao-processual':
                this.renderGestaoProcessual(container);
                break;
            case 'pendencias':
                this.renderPendencias(container);
                break;
            case 'calendario':
                this.renderCalendar(container);
                break;
            case 'faturamento':
                this.renderPlaceholderView(container, 'Gestão de Faturamento', 'fa-file-invoice-dollar', 'Acompanhe o faturamento e fluxo de caixa dos seus projetos.');
                break;
            case 'entregaveis':
                this.renderPlaceholderView(container, 'Gestão de Entregáveis', 'fa-clipboard-check', 'Monitore a qualidade e aprovação dos entregáveis de cada etapa.');
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
        // Status class mapping
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
            ? `<div class="service-badges mt-2">
                ${servicos.map(s =>
                `<span class="service-badge service-badge--primary">${this.escapeHtml(s)}</span>`
            ).join('')}
               </div>`
            : '';

        return `
            <div class="portfolio-spe-row" onclick="App.openSpeDetail('${speKey}')">
                <div class="spe-info-block">
                    <div class="spe-icon-box">
                        <i class="fa-solid fa-building"></i>
                    </div>
                    <div class="spe-details">
                        <div class="spe-name">${this.escapeHtml(spe.name)}</div>
                        <div class="spe-meta-row">
                            ${spe.cnpj ? `<span class="spe-cnpj">${spe.cnpj}</span>` : ''}
                            ${spe.fase ? `<span class="spe-fase">${spe.fase}</span>` : ''}
                        </div>
                        ${serviceBadgesHtml}
                    </div>
                </div>

                <!-- TtV Journey Bar (Restored) -->
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
                
                <div class="spe-col-status flex flex-col gap-1">
                    <span class="status-badge ${statusClass}">${spe.healthStatus?.label || 'Saudável'}</span>
                    ${(spe.healthStatus?.pendingCount || 0) > 0 ? `<span class="pending-count text-xs text-gray-400">${spe.healthStatus.pendingCount} pendente${spe.healthStatus.pendingCount > 1 ? 's' : ''}</span>` : ''}
                </div>
                
                <div class="spe-col-update">
                    ${spe.lastActivity !== null
                ? `<span class="activity-indicator ${spe.lastActivity > 7 ? 'activity-indicator--stale' : 'activity-indicator--recent'}">
                                <i class="fa-solid fa-clock"></i> ${spe.lastActivity === 0 ? 'Hoje' : spe.lastActivity + 'd atrás'}
                           </span>`
                : `<span class="activity-indicator activity-indicator--stale"><i class="fa-solid fa-minus"></i> Sem registro</span>`
            }
                </div>
                
                <div class="spe-col-action">
                    <button class="u-btn u-btn-outline">
                        Abrir <i class="fa-solid fa-arrow-right ml-1"></i>
                    </button>
                </div>
            </div>
        `;
    },

    // ============================================================
    // 3.2. VISÃO OPERAÇÃO (SPE Detail - Analyst Workspace)
    // ============================================================

    openSpeDetail(speName) {
        this.state.activeTab = 'diario';
        this.setView('company', { spe: speName });
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
        const speName = this.state.routeParams.spe;
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

        const isDailyAction = item.type === 'DAILY_ACTION';
        const typeConfig = {
            'reuniao': { icon: 'fa-handshake', color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
            'blocker': { icon: 'fa-exclamation-triangle', color: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
            'observacao': { icon: 'fa-sticky-note', color: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
            'marco': { icon: 'fa-flag-checkered', color: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
            'DAILY_ACTION': { icon: 'fa-tasks', color: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' }
        };
        const config = typeConfig[isDailyAction ? 'DAILY_ACTION' : (item.entryType || 'observacao')] || typeConfig['observacao'];

        return `
            <div class="timeline-entry ${isDailyAction ? 'action-entry' : ''}">
                <div class="timeline-icon ${config.color}"><i class="fa-solid ${config.icon}"></i></div>
                <div class="timeline-body">
                    <div class="timeline-header">
                        <span class="timeline-badge ${config.badge}">${isDailyAction ? 'Pendência Daily' : (item.entryType || 'Registro')}</span>
                        <span class="timeline-date">${WorkingHoursEngine.formatDate(item.date)}</span>
                        <button onclick="App.deleteJournalEntry('${this.escapeAttr(speName)}', ${item.id})" class="timeline-delete" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="timeline-content-wrapper shadow-sm">
                        ${isDailyAction ? `
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${this.getEsteiraColorClass(item.esteira)} uppercase">${item.esteira}</span>
                                <span class="text-[9px] font-medium text-slate-400">Resp: <strong>${this.escapeHtml(item.responsavel)}</strong></span>
                                ${item.prazo ? `<span class="text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid fa-calendar-day mr-1"></i>${WorkingHoursEngine.formatDate(item.prazo)}</span>` : ''}
                                <span class="ml-auto text-[10px] font-bold ${item.status === 'done' ? 'text-emerald-500' : 'text-amber-500'}">
                                    ${item.status === 'done' ? '<i class="fa-solid fa-check"></i> Concluído' : '<i class="fa-solid fa-clock"></i> Pendente'}
                                </span>
                            </div>
                        ` : ''}
                        <p class="timeline-text ${isDailyAction && item.status === 'done' ? 'line-through opacity-50' : ''}">${this.escapeHtml(item.text)}</p>
                    </div>
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
            const isExpanded = this.state.expandedItems[`wf_${esteiraName}`] === true; // Default collapsed
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
                        <h4><i class="fa-solid fa-microchip mr-2 text-teal-600"></i>Sonar & AZO</h4>
                        <div class="cadastro-field">
                            <label>Sonar Business ID</label>
                            <span>${speInfo.sonar_business_id || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Sonar Project ID</label>
                            <span>${speInfo.sonar_project_id || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>ID AZO Ativo</label>
                            <span>${speInfo.id_azo_ativo || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>ID AZO Operação</label>
                            <span>${speInfo.id_azo_operacao || '-'}</span>
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
                            <label>Tipologia</label>
                            <span>${speInfo.tipologia_spe || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>SLA Padrão</label>
                            <span>${speInfo.sla_dias_uteis_padrao || 5} dias úteis</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Serviços</label>
                            <div class="service-badges">
                                ${(speInfo.servicos_contratados || []).map(s => `<span class="service-badge service-badge--primary">${this.escapeHtml(s)}</span>`).join('')}
                            </div>
                        </div>
                        <div class="cadastro-field">
                            <label>TTV (Dias Corridos)</label>
                            <span class="badge badge-info">${speInfo.kpi_ttv_dias_corridos || 0} dias</span>
                        </div>
                    </div>

                    <div class="cadastro-section">
                        <h4><i class="fa-solid fa-user-tie mr-2 text-teal-600"></i>Responsáveis & Origem</h4>
                        <div class="cadastro-field">
                            <label>Key Account</label>
                            <span>${speInfo.nome_do_key_account || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Gerente Comercial</label>
                            <span>${speInfo.gerente_comercial || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Origem</label>
                            <span>${speInfo.origem || '-'}</span>
                        </div>
                    </div>

                    <div class="cadastro-section">
                        <h4><i class="fa-solid fa-file-invoice-dollar mr-2 text-teal-600"></i>Financeiro & Links</h4>
                        <div class="cadastro-field">
                            <label>Política de Pagamento</label>
                            <span>${speInfo.prazo_da_politica_de_pagamentos || '-'}</span>
                        </div>
                        <div class="cadastro-field">
                            <label>Pasta do Projeto</label>
                            ${speInfo.link_pasta ? `<a href="${speInfo.link_pasta}" target="_blank" class="text-indigo-600 hover:underline flex items-center gap-1"><i class="fa-solid fa-external-link text-[10px]"></i> Acessar Pasta</a>` : '<span>-</span>'}
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

    setExecutiveSecondaryFilter(key, value) {
        this.state[key] = value;
        this.render();
    },

    clearAllExecutiveFilters() {
        this.state.overviewFilter = 'all';
        this.state.filterExecutiveERP = '';
        this.state.filterExecutiveFase = '';
        this.state.filterExecutiveTipologia = '';
        this.render();
    },

    // --- VIEW: VISÃO GERAL (Overview) ---
    renderOverview(container) {
        const data = this.getFilteredData();
        const speMap = this.groupBySPE(data);
        const spes = Object.values(speMap);
        const currentFilter = this.state.overviewFilter || 'all';

        // 1. Calculate Primary Counts & Sub-statuses
        const totalOpsCount = spes.length;

        // Filter: Onboarding (everyone not yet concluded)
        const onboardingSpes = spes.filter(s => {
            const status = (s.status_jornada_cliente || '').toLowerCase();
            return status && !status.includes('5. conclu');
        });

        // Filter: Critical Pendencies (already has custom logic)
        // Filter: Critical Pendencies (Active Only)
        // Rule: Only show critical issues for non-concluded operations
        const criticalSpes = spes.filter(s => {
            const isConcluded = (s.status_jornada_cliente || '').toLowerCase().includes('conclu');
            if (isConcluded) return false;

            const hasBlockedTask = s.tasks.some(t => (t.status_tarefa || '').toLowerCase().includes('bloq'));
            const isDelayed = (s.status_jornada_cliente || '').includes('3. Atrasado');
            return hasBlockedTask || isDelayed;
        });

        // Sub-status breakout for Onboarding based on RAW status_jornada_cliente
        const statusCounts = onboardingSpes.reduce((acc, s) => {
            const st = s.status_jornada_cliente || 'N/A';
            acc[st] = (acc[st] || 0) + 1;
            return acc;
        }, {});
        const uniqueOnboardingStatuses = Object.keys(statusCounts).sort();

        // 2. Select data for the detail list based on filter
        let filteredList = [];
        let listTitle = "Listagem Geral";

        switch (currentFilter) {
            case 'all':
                filteredList = spes;
                listTitle = "Todas as Operações";
                break;
            case 'onboarding':
                filteredList = onboardingSpes;
                listTitle = "Operações em Onboarding";
                break;
            case 'critical':
                filteredList = criticalSpes;
                listTitle = "Operações com Pendências Críticas";
                break;
            default:
                // Direct match with status_jornada_cliente
                filteredList = onboardingSpes.filter(s => (s.status_jornada_cliente || 'N/A') === currentFilter);
                listTitle = `Onboarding: ${currentFilter}`;
        }

        // Apply Secondary Filters (Charts)
        if (this.state.filterExecutiveERP) {
            filteredList = filteredList.filter(s => (s.erp || 'N/A') === this.state.filterExecutiveERP);
        }
        if (this.state.filterExecutiveFase) {
            filteredList = filteredList.filter(s => (s.fase_da_spe || 'N/A') === this.state.filterExecutiveFase);
        }
        if (this.state.filterExecutiveTipologia) {
            filteredList = filteredList.filter(s => (s.tipologia_spe || 'N/A') === this.state.filterExecutiveTipologia);
        }

        // External Causes (Client Pending)
        // Groups: Cliente - correção, Cliente - documentação, Cliente - validação
        // Uses flexible matching to handle potential variations in spacing or delimiters
        const clientPendingTasks = data.filter(t => {
            const status = (t.status_real || '').toLowerCase();
            const statusDet = (t.status_esteira_detalhado || '').toLowerCase();
            const resp = (t.responsabilidade || '').toLowerCase();
            const tags = (t.responsavel_direto_tags || '').toLowerCase();

            const combined = `${status} ${statusDet} ${resp} ${tags}`;

            // Logica: Tem que ter "cliente" E um dos termos chave
            if (!combined.includes('cliente')) return false;

            // Business Rule: Exclude Concluded Tasks
            if (status.includes('conclu') || status.includes('entregue') || status.includes('finaliz')) return false;

            return combined.includes('correção') ||
                combined.includes('documentação') ||
                combined.includes('validação') ||
                combined.includes('validacao') || // Fallback no accent
                combined.includes('correcao') ||  // Fallback no accent
                combined.includes('documentacao'); // Fallback no accent
        });

        // Average TTV
        const ttvArray = spes.map(s => s.kpi_ttv_dias_corridos || 0).filter(v => v > 0);
        const avgTtv = ttvArray.length > 0 ? Math.round(ttvArray.reduce((as, b) => as + b, 0) / ttvArray.length) : 0;

        // Top 10 Delays logic (fixed status_real reference)
        const clientDelays = {};
        data.forEach(t => {
            const client = t.razao_social_cliente || 'N/A';
            const status = (t.status_real || '').toLowerCase();
            if (status.includes('bloq') || status.includes('atras') || status.includes('risco')) {
                if (!clientDelays[client]) clientDelays[client] = { name: client, count: 0 };
                clientDelays[client].count++;
            }
        });
        const top10Clients = Object.values(clientDelays).sort((a, b) => b.count - a.count).slice(0, 10);

        // UI Helpers
        const cardClass = "bg-white p-6 rounded-2xl shadow-sm border transition-all cursor-pointer hover:shadow-md hover:border-indigo-200 flex flex-col group";
        const activeClass = "border-indigo-500 ring-2 ring-indigo-50 shadow-md";

        container.innerHTML = `
            <div class="fade-in animate-fade-in">
                <!-- Header -->
                <div class="mb-8 flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">Painel Executivo</h2>
                        <div class="flex items-center gap-2 mt-1">
                            <p class="text-sm text-slate-500">Visão consolidada e filtros dinâmicos de operação.</p>
                            ${this.state.filterExecutiveERP ? `<span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-100 flex items-center gap-1">ERP: ${this.state.filterExecutiveERP} <i class="fa-solid fa-times cursor-pointer" onclick="App.setExecutiveSecondaryFilter('filterExecutiveERP', '')"></i></span>` : ''}
                            ${this.state.filterExecutiveFase ? `<span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-100 flex items-center gap-1">Fase: ${this.state.filterExecutiveFase} <i class="fa-solid fa-times cursor-pointer" onclick="App.setExecutiveSecondaryFilter('filterExecutiveFase', '')"></i></span>` : ''}
                            ${this.state.filterExecutiveTipologia ? `<span class="bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-teal-100 flex items-center gap-1">Tipologia: ${this.state.filterExecutiveTipologia} <i class="fa-solid fa-times cursor-pointer" onclick="App.setExecutiveSecondaryFilter('filterExecutiveTipologia', '')"></i></span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Main KPI Grid -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
                    <!-- Total Ops -->
                    <div onclick="App.setOverviewFilter('all')" 
                         class="md:col-span-2 ${cardClass} ${currentFilter === 'all' ? activeClass : 'border-slate-100'} items-center justify-center text-center">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operações Totais</span>
                        <span class="text-4xl font-extrabold text-slate-800 mb-2">${totalOpsCount}</span>
                        <div class="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                    </div>

                    <!-- Onboarding Multi-Card -->
                    <div class="md:col-span-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div onclick="App.setOverviewFilter('onboarding')" 
                             class="md:col-span-1 ${cardClass} relative overflow-hidden ${currentFilter === 'onboarding' ? activeClass : 'border-slate-100'} justify-center">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Onboarding</span>
                            <div class="flex items-center gap-3">
                                <span class="text-4xl font-extrabold text-blue-600">${onboardingSpes.length}</span>
                                <span class="text-[10px] text-slate-400 leading-tight">Projetos<br>Ativos</span>
                            </div>
                            <i class="fa-solid fa-rocket text-blue-50 text-4xl absolute -right-4 -bottom-4 transform rotate-12"></i>
                            <p class="text-[9px] text-blue-400 mt-2 font-bold uppercase tracking-wider">Ver Todos</p>
                        </div>
                        
                        <div class="md:col-span-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-nowrap overflow-x-auto gap-3 items-center custom-scrollbar">
                            ${uniqueOnboardingStatuses.map(status => {
            const count = statusCounts[status];
            const isActive = currentFilter === status;
            return `
                                    <div onclick="App.setOverviewFilter('${this.escapeAttr(status)}')" 
                                         class="flex flex-col items-center justify-center cursor-pointer hover:bg-white p-3 min-w-[100px] rounded-xl transition-all border border-transparent hover:border-slate-100 ${isActive ? 'bg-white shadow-sm ring-1 ring-indigo-500' : ''}">
                                        <span class="text-2xl font-bold text-indigo-600 mb-1">${count}</span>
                                        <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight text-center leading-3 h-6 flex items-center justify-center overflow-hidden line-clamp-2" title="${this.escapeAttr(status)}">${this.escapeHtml(status)}</span>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>

                    <!-- Critical Pendencies -->
                    <div onclick="App.setOverviewFilter('critical')" 
                         class="md:col-span-2 ${cardClass} ${currentFilter === 'critical' ? activeClass : 'border-slate-100'} items-center justify-center text-center">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pendências Críticas</span>
                        <span class="text-4xl font-extrabold text-rose-600 mb-2">${criticalSpes.length}</span>
                        <div class="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                    </div>
                </div>

                <!-- Strategic Charts Section -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-microchip text-indigo-500"></i> Empresas por ERP
                        </h3>
                        <div class="h-64">
                            <canvas id="erpChart"></canvas>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-layer-group text-blue-500"></i> Empresas por Fase
                        </h3>
                        <div class="h-64">
                            <canvas id="faseChart"></canvas>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-tags text-teal-500"></i> Empresas por Tipologia
                        </h3>
                        <div class="h-64">
                            <canvas id="tipologiaChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Expanded Client Pendencies Section (Full Width) -->
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-4 px-2">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                                <i class="fa-solid fa-user-clock text-lg"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-slate-800">Pendências com Clientes</h3>
                                <p class="text-xs text-slate-500">Apenas pendências abertas (não concluídas). Top 15 por categoria.</p>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        ${['Correção', 'Documentação', 'Validação'].map(type => {
            const typeLower = type.toLowerCase();

            // Filter logic: Match type AND Open Status
            const tasks = clientPendingTasks.filter(t => {
                const status = (t.status_real || '').toLowerCase();
                const statusDet = (t.status_esteira_detalhado || '').toLowerCase();
                const resp = (t.responsabilidade || '').toLowerCase();
                const tags = (t.responsavel_direto_tags || '').toLowerCase();

                const combined = `${status} ${statusDet} ${resp} ${tags}`;

                // Explicitly Exclude Completed Tasks (already filtered in definition but safe to double check)
                if (status.includes('conclu') || status.includes('entregue') || status.includes('finaliz')) return false;

                if (typeLower === 'validação') return combined.includes('validação') || combined.includes('validacao');
                if (typeLower === 'correção') return combined.includes('correção') || combined.includes('correcao');
                if (typeLower === 'documentação') return combined.includes('documentação') || combined.includes('documentacao');

                return combined.includes(typeLower);
            });

            const count = tasks.length;
            // Sort by deadline asc (most overdue first)
            const sortedTasks = tasks.sort((a, b) => (new Date(a.data_prazo_sla || '2099-12-31') - new Date(b.data_prazo_sla || '2099-12-31')));
            const top15 = sortedTasks.slice(0, 15);

            let icon = 'fa-wrench';
            let color = 'amber';
            let bgClass = 'bg-amber-50';
            let textClass = 'text-amber-600';
            let borderClass = 'border-amber-100';

            if (type === 'Documentação') {
                icon = 'fa-file-contract';
                color = 'blue';
                bgClass = 'bg-blue-50';
                textClass = 'text-blue-600';
                borderClass = 'border-blue-100';
            }
            if (type === 'Validação') {
                icon = 'fa-check-double';
                color = 'indigo';
                bgClass = 'bg-indigo-50';
                textClass = 'text-indigo-600';
                borderClass = 'border-indigo-100';
            }

            return `
                                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow">
                                    <!-- Header -->
                                    <div class="${bgClass} p-4 border-b ${borderClass} flex items-center justify-between">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center ${textClass}">
                                                <i class="fa-solid ${icon}"></i>
                                            </div>
                                            <span class="font-bold text-slate-700 uppercase tracking-wide text-sm">${type}</span>
                                        </div>
                                        <span class="bg-white ${textClass} px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">${count}</span>
                                    </div>

                                    <!-- Content List -->
                                    <div class="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
                                        ${top15.length > 0 ? `
                                            <div class="divide-y divide-slate-50">
                                            ${top15.map(t => `
                                                <div class="p-3 hover:bg-slate-50 transition-colors group">
                                                    <div class="flex justify-between items-start mb-0.5">
                                                        <div class="min-w-0 flex-1 mr-2">
                                                            <!-- Line 1: Task Name (Primary) -->
                                                            <div class="text-xs font-bold text-slate-700 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors" title="${this.escapeAttr(t.nome_tarefa)}">
                                                                ${t.nome_tarefa || 'Tarefa sem nome'}
                                                            </div>
                                                        </div>
                                                        ${t.diasAtraso > 0
                    ? `<span class="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded whitespace-nowrap border border-rose-100 flex-shrink-0 mt-0.5">${t.diasAtraso}d</span>`
                    : ``
                }
                                                    </div>
                                                    <!-- Line 2: Client Name + Group (Secondary) -->
                                                    <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                                                        <span class="text-[10px] text-slate-500 font-medium truncate max-w-full" title="${this.escapeAttr(t.razao_social_da_spe)}">${this.escapeHtml(t.razao_social_da_spe)}</span>
                                                        ${t.grupo_cliente ? `<span class="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-400 border border-slate-200 uppercase tracking-tight">${this.escapeHtml(t.grupo_cliente)}</span>` : ''}
                                                    </div>
                                                </div>
                                            `).join('')}
                                            </div>
                                        ` : `
                                            <div class="h-40 flex flex-col items-center justify-center text-slate-300">
                                                <i class="fa-regular fa-circle-check text-3xl mb-2 opacity-30"></i>
                                                <span class="text-xs italic">Tudo em dia!</span>
                                            </div>
                                        `}
                                    </div>

                                    <!-- Footer Action -->
                                    <div class="p-3 bg-slate-50 border-t border-slate-100">
                                        <button onclick="App.setOverviewFilter('client_${typeLower}')" 
                                                class="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-sm transition-all flex items-center justify-center gap-2 group-hover:border-indigo-200">
                                            <span>Ver Todos (${count})</span>
                                            <i class="fa-solid fa-arrow-right text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-8 mb-8">

                    <!-- Filtered Detail List (Dynamic Section) -->
                    <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden ring-4 ring-indigo-50/20">
                        <div class="p-6 bg-slate-50/30 border-bottom border-slate-100 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                <h3 class="font-bold text-slate-800">${listTitle}</h3>
                                <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">${filteredList.length}</span>
                            </div>
                            ${(currentFilter !== 'all' || this.state.filterExecutiveERP || this.state.filterExecutiveFase || this.state.filterExecutiveTipologia) ? `
                                <button onclick="App.clearAllExecutiveFilters()" class="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors">
                                    <i class="fa-solid fa-times-circle"></i> Limpar Filtros
                                </button>
                            ` : ''}
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm border-collapse">
                                <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th class="px-6 py-3">Empresa / Cliente</th>
                                        <th class="px-6 py-3">Status Jornada</th>
                                        <th class="px-6 py-3">Saúde</th>
                                        <th class="px-6 py-3 text-right">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    ${filteredList.length > 0 ? filteredList.slice(0, 15).map(s => {
            const h = s.healthStatus;
            const statusClass = h.status === 'risk' ? 'status-badge--delayed' :
                h.status === 'attention' ? 'status-badge--at-risk' :
                    h.status === 'healthy' ? 'status-badge--completed' : 'status-badge--on-track';

            return `
                                            <tr class="hover:bg-slate-50/70 transition-colors">
                                                <td class="px-6 py-4">
                                                    <div class="font-bold text-slate-700 truncate max-w-[220px]">${this.escapeHtml(s.name)}</div>
                                                    <div class="text-[10px] text-slate-400 uppercase font-medium">${this.escapeHtml(s.razao_social_cliente)}</div>
                                                </td>
                                                <td class="px-6 py-4">
                                                    <span class="text-xs font-medium text-slate-600">${this.escapeHtml(s.status_jornada_cliente || 'Em andamento')}</span>
                                                    <div class="text-[9px] text-slate-400 mt-0.5">${this.escapeHtml(s.fase_da_spe || '-')}</div>
                                                </td>
                                                <td class="px-6 py-4">
                                                    <span class="status-badge ${statusClass}">${h.label}</span>
                                                </td>
                                                <td class="px-6 py-4 text-right">
                                                    <button onclick="App.setView('company', { spe: '${this.escapeAttr(s.name)}' })" 
                                                            class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center ml-auto">
                                                        <i class="fa-solid fa-eye"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
        }).join('') : `
                                        <tr>
                                            <td colspan="4" class="px-6 py-12 text-center text-slate-400 italic">Nenhuma empresa encontrada com este filtro.</td>
                                        </tr>
                                    `}
                                </tbody>
                            </table>
                            ${filteredList.length > 15 ? `
                                <div class="p-3 text-center bg-slate-50/50 border-t border-slate-100">
                                    <p class="text-[10px] font-bold text-slate-400 italic">Exibindo as primeiras 15 de ${filteredList.length} operações.</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Footer: Pendencias com Clientes -->
                <div class="bg-indigo-900 rounded-2xl p-6 text-white flex items-center justify-between shadow-lg shadow-indigo-100">
                    <div class="flex items-center gap-6">
                        <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white text-xl">
                            <i class="fa-solid fa-handshake"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg">Pendências com Clientes</h3>
                            <p class="text-sm text-indigo-200">Existem <strong>${clientPendingTasks.length}</strong> tarefas aguardando retorno ou ação direta do cliente.</p>
                        </div>
                    </div>
                    <button onclick="App.setView('pendencias')" class="bg-white text-indigo-900 font-bold px-6 py-2 rounded-xl text-sm hover:bg-slate-100 transition-colors">
                        Atuar no Comercial
                    </button>
                </div>
            </div>
        `;

        // Initialize charts after HTML is appended
        this.renderExecutiveCharts(spes);
    },


    renderExecutiveCharts(spes) {
        // ERP Distribution
        const erpData = spes.reduce((acc, s) => {
            const erp = s.erp || 'N/A';
            acc[erp] = (acc[erp] || 0) + 1;
            return acc;
        }, {});

        // Fase Distribution
        const faseData = spes.reduce((acc, s) => {
            const fase = s.fase_da_spe || 'N/A';
            acc[fase] = (acc[fase] || 0) + 1;
            return acc;
        }, {});

        // Tipologia Distribution
        const tipologiaData = spes.reduce((acc, s) => {
            const tipologia = s.tipologia_spe || 'N/A';
            acc[tipologia] = (acc[tipologia] || 0) + 1;
            return acc;
        }, {});

        this.renderPieChart('erpChart', Object.keys(erpData), Object.values(erpData), ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'], (val) => this.setExecutiveSecondaryFilter('filterExecutiveERP', val));
        this.renderPieChart('faseChart', Object.keys(faseData), Object.values(faseData), ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'], (val) => this.setExecutiveSecondaryFilter('filterExecutiveFase', val));
        this.renderPieChart('tipologiaChart', Object.keys(tipologiaData), Object.values(tipologiaData), ['#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'], (val) => this.setExecutiveSecondaryFilter('filterExecutiveTipologia', val));
    },

    renderPieChart(canvasId, labels, values, colors, onSelect = null) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Destroy existing instance if any
        if (this.state.chartInstances[canvasId]) {
            this.state.chartInstances[canvasId].destroy();
        }

        this.state.chartInstances[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0 && onSelect) {
                        const index = elements[0].index;
                        const label = labels[index];
                        onSelect(label);
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: { size: 10, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        titleFont: { size: 12 },
                        bodyFont: { size: 12 }
                    }
                }
            }
        });
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

    // --- MODULE: GESTÃO PROCESSUAL (Esteiras + SLA) ---
    renderGestaoProcessual(container) {
        container.innerHTML = `
            <div class="fade-in px-2">
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-slate-800">Gestão Processual</h2>
                    <p class="text-sm text-slate-500">Métricas de performance por esteiras e análise de SLA.</p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <!-- Column 1: Performance Table -->
                    <div id="processual-table-container"></div>
                    
                    <!-- Column 2: SLA Chart -->
                    <div id="processual-chart-container" class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 class="font-bold text-slate-800 mb-6 flex items-center justify-between">
                            <span>SLA Previsto vs Lead Time Real</span>
                            <i class="fa-solid fa-scale-balanced text-indigo-500"></i>
                        </h3>
                        <div class="h-80">
                            <canvas id="slaComparisonChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Secondary Stats Row -->
                <div id="processual-stats-container" class="grid grid-cols-1 md:grid-cols-3 gap-6"></div>
            </div>
        `;

        // Render components into containers
        const tableContainer = document.getElementById('processual-table-container');
        const statsContainer = document.getElementById('processual-stats-container');

        // Populate the components
        this.renderEsteiras(tableContainer);
        this.renderSLAChartsAndStats(statsContainer);
    },

    // Refactored helper to render SLA charts and stats correctly
    renderSLAChartsAndStats(statsContainer) {
        const data = this.getFilteredData();
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

        const avgSla = Math.round(slaData.reduce((a, b) => a + b, 0) / (slaData.length || 1));
        const avgLead = Math.round(leadTimeData.reduce((a, b) => a + b, 0) / (leadTimeData.length || 1));
        const isHealthy = avgLead <= avgSla;

        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
                    <div class="text-3xl font-bold text-blue-600 mb-1">${avgSla}</div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SLA Médio (dias)</div>
                </div>
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
                    <div class="text-3xl font-bold text-indigo-600 mb-1">${avgLead}</div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Time Médio (dias)</div>
                </div>
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
                    <div class="text-3xl font-bold ${isHealthy ? 'text-emerald-500' : 'text-rose-500'} mb-1">
                        ${isHealthy ? '✓ Saudável' : '⚠ Crítico'}
                    </div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Geral SLA</div>
                </div>
            `;
        }

        // Initialize Chart
        const ctx = document.getElementById('slaComparisonChart');
        if (ctx) {
            this.state.chartInstances.slaChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'SLA Previsto', data: slaData, backgroundColor: '#6366f1', borderRadius: 6 },
                        { label: 'Lead Time Real', data: leadTimeData, backgroundColor: '#94a3b8', borderRadius: 6 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
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

        // Apply Local Filters
        let filteredPending = pending;
        if (this.state.filterPendenciasSpe) {
            filteredPending = filteredPending.filter(p => p.razao_social_da_spe === this.state.filterPendenciasSpe);
        }
        if (this.state.filterPendenciasEsteira) {
            filteredPending = filteredPending.filter(p => p.esteira === this.state.filterPendenciasEsteira);
        }

        // Options for the filters
        const availableSpes = [...new Set(pending.map(p => p.razao_social_da_spe))].sort();
        const availableEsteiras = [...new Set(pending.map(p => p.esteira))].sort();
        const availableResponsibles = [...new Set(pending.map(p => p.responsabilidade).filter(Boolean))].sort();
        const availableAreas = [...new Set(pending.map(p => p.responsavel_direto_tags).filter(Boolean))].sort();

        if (this.state.filterPendenciasArea) {
            filteredPending = filteredPending.filter(p => p.responsavel_direto_tags === this.state.filterPendenciasArea);
        }

        if (this.state.filterPendenciasResponsavel) {
            filteredPending = filteredPending.filter(p => p.responsabilidade === this.state.filterPendenciasResponsavel);
        }

        // Calculate days delayed
        const pendenciasWithDelay = filteredPending.map(d => {
            let diasAtraso = 0;
            if (d.data_prazo_sla) {
                const prazo = new Date(d.data_prazo_sla + 'T00:00:00');
                diasAtraso = Math.max(0, Math.floor((today - prazo) / (1000 * 60 * 60 * 24)));
            }
            return { ...d, diasAtraso };
        }).sort((a, b) => b.diasAtraso - a.diasAtraso);

        container.innerHTML = `
            <div class="fade-in px-2">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">Pendências de Atividades</h2>
                        <p class="text-sm text-slate-500">Gestão de tarefas em aberto e controle de atrasos.</p>
                    </div>
                </div>

                <!-- Filters Bar -->
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-6 items-center">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-building text-slate-400"></i>
                            <span class="text-sm font-semibold text-slate-600">Empresa:</span>
                        </div>
                        <select onchange="App.setPendenciasFilter('filterPendenciasSpe', this.value)" class="u-select px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
                            <option value="">Todas as Empresas</option>
                            ${availableSpes.map(s => `<option value="${this.escapeAttr(s)}" ${this.state.filterPendenciasSpe === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-stream text-slate-400"></i>
                            <span class="text-sm font-semibold text-slate-600">Esteira:</span>
                        </div>
                        <select onchange="App.setPendenciasFilter('filterPendenciasEsteira', this.value)" class="u-select px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
                            <option value="">Todas as Esteiras</option>
                            ${availableEsteiras.map(e => `<option value="${this.escapeAttr(e)}" ${this.state.filterPendenciasEsteira === e ? 'selected' : ''}>${this.escapeHtml(e)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-user-circle text-slate-400"></i>
                            <span class="text-sm font-semibold text-slate-600">Responsável:</span>
                        </div>
                        <select onchange="App.setPendenciasFilter('filterPendenciasResponsavel', this.value)" class="u-select px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
                            <option value="">Todos os Responsáveis</option>
                            ${availableResponsibles.map(r => `<option value="${this.escapeAttr(r)}" ${this.state.filterPendenciasResponsavel === r ? 'selected' : ''}>${this.escapeHtml(r)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-tags text-slate-400"></i>
                            <span class="text-sm font-semibold text-slate-600">Área:</span>
                        </div>
                        <select onchange="App.setPendenciasFilter('filterPendenciasArea', this.value)" class="u-select px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]">
                            <option value="">Todas as Áreas</option>
                            ${availableAreas.map(a => `<option value="${this.escapeAttr(a)}" ${this.state.filterPendenciasArea === a ? 'selected' : ''}>${this.escapeHtml(a)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="ml-auto text-xs text-slate-400">
                        Exibindo <strong>${filteredPending.length}</strong> de ${pending.length} pendências globais
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 class="font-bold text-slate-800"><i class="fa-solid fa-exclamation-triangle mr-2 text-amber-500"></i>Tarefas Pendentes (${filteredPending.length})</h3>
                        <div class="text-sm text-slate-500">
                            <span class="text-red-600 font-semibold">${filteredPending.filter(p => p.is_delayed).length}</span> em atraso
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
                                    <th>Área</th>
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
                                            <div class="service-badges mt-1">
                                                ${(p.servicos_contratados || []).map(s => `<span class="service-badge">${this.escapeHtml(s)}</span>`).join('')}
                                            </div>
                                        </td>
                                        <td class="max-w-xs truncate" title="${this.escapeAttr(p.nome_tarefa)}">${this.escapeHtml(p.nome_tarefa)}</td>
                                        <td class="text-center">
                                            ${p.diasAtraso > 0
                ? `<span class="delay-badge">${p.diasAtraso} dias</span>`
                : '<span class="text-slate-400">-</span>'
            }
                                        </td>
                                        <td class="text-slate-600">${this.escapeHtml(p.responsabilidade)}</td>
                                        <td>
                                            <span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase">
                                                ${this.escapeHtml(p.responsavel_direto_tags || '-')}
                                            </span>
                                        </td>
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

    // --- MODULE: GESTÃO OPERACIONAL (Daily + Central) ---
    renderGestaoOperacional(container) {
        const subView = this.state.operacionalSubView || 'lancamentos';

        container.innerHTML = `
            <div class="fade-in">
                <!-- Sub-Navigation Tabs -->
                <div class="px-6 pt-4 mb-6">
                    <div class="flex border-b border-slate-200">
                        <button onclick="App.setOperacionalSubView('lancamentos')" 
                                class="px-6 py-3 text-sm font-bold border-b-2 transition-all ${subView === 'lancamentos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}">
                            <i class="fa-solid fa-plus-circle mr-2"></i> Lançamento Diário
                        </button>
                        <button onclick="App.setOperacionalSubView('historico')" 
                                class="px-6 py-3 text-sm font-bold border-b-2 transition-all ${subView === 'historico' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}">
                            <i class="fa-solid fa-clock-rotate-left mr-2"></i> Central de Registros
                        </button>
                    </div>
                </div>

                <!-- Content Area -->
                <div id="operacional-content"></div>
            </div>
        `;

        const subContainer = document.getElementById('operacional-content');
        if (subView === 'lancamentos') {
            this.renderDaily(subContainer);
        } else {
            this.renderDailyHistory(subContainer);
        }
    },

    setOperacionalSubView(view) {
        this.state.operacionalSubView = view;
        this.render();
    },

    setPendenciasFilter(filterKey, value) {
        this.state[filterKey] = value;
        this.render();
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

                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-6 items-center">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-filter text-slate-400"></i>
                        <span class="text-sm font-semibold text-slate-600">Exibir Status:</span>
                    </div>
                    
                    <div class="flex flex-wrap gap-4">
                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" ${this.state.filterDailyStatuses.includes('risk') ? 'checked' : ''} 
                                   onchange="App.toggleDailyStatusFilter('risk')"
                                   class="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500">
                            <span class="text-xs font-bold text-slate-600 group-hover:text-rose-600 transition-colors">Bloqueado / Risco Crítico</span>
                        </label>

                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" ${this.state.filterDailyStatuses.includes('attention') ? 'checked' : ''} 
                                   onchange="App.toggleDailyStatusFilter('attention')"
                                   class="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500">
                            <span class="text-xs font-bold text-slate-600 group-hover:text-amber-500 transition-colors">Em Atenção / Atraso</span>
                        </label>

                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" ${this.state.filterDailyStatuses.includes('ok') ? 'checked' : ''} 
                                   onchange="App.toggleDailyStatusFilter('ok')"
                                   class="w-4 h-4 text-indigo-500 border-slate-300 rounded focus:ring-indigo-500">
                            <span class="text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Em Andamento (OK)</span>
                        </label>

                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" ${this.state.filterDailyStatuses.includes('healthy') ? 'checked' : ''} 
                                   onchange="App.toggleDailyStatusFilter('healthy')"
                                   class="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500">
                            <span class="text-xs font-bold text-slate-600 group-hover:text-emerald-500 transition-colors">Concluído / Ativo</span>
                        </label>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-4">
                    ${this.renderDailyList(clients)}
                </div>
            </div>
        `;
    },

    toggleDailyStatusFilter(status) {
        if (!this.state.filterDailyStatuses) this.state.filterDailyStatuses = ['risk', 'attention', 'ok'];

        const idx = this.state.filterDailyStatuses.indexOf(status);
        if (idx === -1) {
            this.state.filterDailyStatuses.push(status);
        } else {
            this.state.filterDailyStatuses.splice(idx, 1);
        }
        this.render();
    },

    renderDailyList(clients) {
        let html = '';
        clients.forEach(client => {
            const filteredSpes = client.spes.filter(spe => {
                if (!this.state.filterDailyStatuses || this.state.filterDailyStatuses.length === 0) return true;
                return this.state.filterDailyStatuses.includes(spe.healthStatus.status);
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

        // Group tasks by esteira to show complexity
        const esteiraStats = {};
        spe.tasks.forEach(t => {
            const e = t.esteira || 'Geral';
            if (!esteiraStats[e]) esteiraStats[e] = { name: e, tasks: [] };
            esteiraStats[e].tasks.push(t);
        });

        const sortedEsteiras = Object.values(esteiraStats).map(e => ({
            ...e,
            status: this.getSpeStatus(e.tasks)
        })).sort((a, b) => {
            const scores = { risk: 10, attention: 5, ok: 2, healthy: 1, unknown: 0 };
            return (scores[b.status.status] || 0) - (scores[a.status.status] || 0);
        });

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
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${status.color === 'red' ? 'bg-red-100 text-red-700' : status.color === 'amber' ? 'bg-amber-100 text-amber-700' : status.color === 'emerald' || status.color === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}">
                                    ${status.label}
                                </span>
                                <span class="text-[10px] text-slate-400 font-medium">${spe.fase}</span>
                            </div>
                            <div class="service-badges mt-1">
                                ${(spe.servicos_contratados || []).map(s => `<span class="service-badge">${this.escapeHtml(s)}</span>`).join('')}
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
                            <i class="fa-solid fa-layer-group text-slate-400 text-xs"></i> Saúde por Esteira / Setor
                        </h5>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            ${sortedEsteiras.map(est => {
            let badgeClass = 'bg-slate-50 text-slate-500 border-slate-100';
            if (est.status.status === 'risk') badgeClass = 'bg-rose-50 text-rose-700 border-rose-100';
            else if (est.status.status === 'attention') badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
            else if (est.status.status === 'ok' || est.status.status === 'healthy') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';

            return `
                                    <div class="p-2 rounded-lg border ${badgeClass} flex flex-col items-center text-center">
                                        <span class="text-[10px] font-bold truncate w-full" title="${est.name}">${est.name}</span>
                                        <span class="text-[9px] font-medium opacity-80 mt-1">${est.status.label}</span>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>
                    
                    <div class="flex flex-col">
                        <h5 class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-3">
                            <i class="fa-solid fa-list-check text-indigo-500 text-xs"></i> Ações da Daily / Pendências do Dia
                        </h5>
                        
                        <!-- Action List -->
                        <div class="flex-1 overflow-y-auto max-h-48 mb-4 space-y-2 pr-1 custom-scrollbar">
                            ${(this.state.journals[spe.name] || [])
                .filter(j => j.type === 'DAILY_ACTION')
                .sort((a, b) => (a.status === 'done' ? 1 : -1))
                .map(action => `
                                    <div class="group flex items-start gap-3 p-2 rounded-lg border ${action.status === 'done' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'} transition-all">
                                        <button onclick="App.toggleDailyAction('${this.escapeAttr(spe.name)}', ${action.id})" class="mt-0.5 w-4 h-4 rounded border ${action.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'} flex items-center justify-center transition-colors">
                                            ${action.status === 'done' ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}
                                        </button>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-0.5">
                                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${this.getEsteiraColorClass(action.esteira)} uppercase">${action.esteira}</span>
                                                <span class="text-[9px] font-medium text-slate-400">@${this.escapeHtml(action.responsavel)}</span>
                                                ${action.prazo ? `<span class="text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 ml-auto"><i class="fa-solid fa-calendar-day mr-1"></i>${WorkingHoursEngine.formatDate(action.prazo)}</span>` : ''}
                                            </div>
                                            <p class="text-xs text-slate-700 leading-tight ${action.status === 'done' ? 'line-through' : ''}">${this.escapeHtml(action.text)}</p>
                                        </div>
                                        <button onclick="App.deleteDailyAction('${this.escapeAttr(spe.name)}', ${action.id})" class="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all">
                                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                                        </button>
                                    </div>
                                `).join('') || '<div class="text-center py-6 text-slate-300 italic text-xs">Nenhuma ação registrada hoje.</div>'}
                        </div>

                        <!-- Add Action Form -->
                        <div class="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50">
                            <!-- Toggle Type -->
                            <div class="flex p-0.5 bg-slate-200/50 rounded-lg mb-3 w-fit">
                                <button 
                                    onclick="App.setEntryType('${this.escapeAttr(spe.name)}', 'todo')" 
                                    class="px-3 py-1 text-[10px] font-bold rounded-md transition-all ${this.state.entryMode?.[spe.name] !== 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
                                >
                                    <i class="fa-solid fa-list-check mr-1"></i> Ação (To-do)
                                </button>
                                <button 
                                    onclick="App.setEntryType('${this.escapeAttr(spe.name)}', 'report')" 
                                    class="px-3 py-1 text-[10px] font-bold rounded-md transition-all ${this.state.entryMode?.[spe.name] === 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
                                >
                                    <i class="fa-solid fa-note-sticky mr-1"></i> Relato (Report)
                                </button>
                            </div>

                            <div id="form-fields-${this.escapeAttr(spe.name)}" class="${this.state.entryMode?.[spe.name] === 'report' ? 'hidden' : 'grid'} grid-cols-3 gap-2 mb-2">
                                <select id="action-esteira-${this.escapeAttr(spe.name)}" class="text-[10px] font-bold border-slate-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500">
                                    ${sortedEsteiras.map(e => `<option value="${this.escapeAttr(e.name)}">${this.escapeHtml(e.name)}</option>`).join('')}
                                    <option value="Geral">Geral</option>
                                </select>
                                <input id="action-resp-${this.escapeAttr(spe.name)}" type="text" placeholder="Responsável" class="text-[10px] border-slate-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500">
                                <input id="action-prazo-${this.escapeAttr(spe.name)}" type="date" class="text-[10px] border-slate-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500">
                            </div>
                            <div class="flex gap-2">
                                <input id="action-text-${this.escapeAttr(spe.name)}" type="text" placeholder="${this.state.entryMode?.[spe.name] === 'report' ? 'Descreva o relato ou alinhamento geral...' : 'Descreva a ação ou pendência...'}" class="flex-1 text-xs border-slate-200 rounded p-2 outline-none focus:ring-1 focus:ring-indigo-500">
                                <button 
                                    onclick="App.addDailyAction('${this.escapeAttr(spe.name)}')"
                                    class="bg-indigo-600 text-white rounded-lg px-3 py-2 text-xs font-bold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                                >
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    setEntryType(speName, type) {
        if (!this.state.entryMode) this.state.entryMode = {};
        this.state.entryMode[speName] = type;
        this.render();
    },

    addDailyAction(speName) {
        const textEl = document.getElementById(`action-text-${speName}`);
        const respEl = document.getElementById(`action-resp-${speName}`);
        const estEl = document.getElementById(`action-esteira-${speName}`);
        const prazoEl = document.getElementById(`action-prazo-${speName}`);
        const mode = this.state.entryMode?.[speName] || 'todo';

        if (!textEl.value.trim()) return;

        const entry = {
            text: textEl.value,
            type: 'DAILY_ACTION',
            subType: mode, // 'todo' or 'report'
            status: mode === 'todo' ? 'todo' : 'info',
            date: new Date().toISOString().split('T')[0]
        };

        if (mode === 'todo') {
            entry.responsavel = respEl.value || 'N/A';
            entry.esteira = estEl.value;
            entry.prazo = prazoEl.value || null;
        } else {
            entry.esteira = 'Geral';
            entry.responsavel = 'Sistema';
        }

        this.saveJournalEntry(speName, entry);

        // Clear input
        textEl.value = '';
    },

    toggleDailyAction(speName, actionId) {
        const actions = this.state.journals[speName] || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
            action.status = action.status === 'done' ? 'todo' : 'done';
            localStorage.setItem('trinus_journals', JSON.stringify(this.state.journals));
            this.render();
        }
    },

    deleteDailyAction(speName, actionId) {
        if (!confirm('Deseja excluir esta ação?')) return;
        this.state.journals[speName] = this.state.journals[speName].filter(a => a.id !== actionId);
        localStorage.setItem('trinus_journals', JSON.stringify(this.state.journals));
        this.render();
    },

    getEsteiraColorClass(name) {
        // Map common names to tailwind classes for the action badges
        const mapping = {
            'comercial': 'bg-indigo-50 text-indigo-600 border-indigo-100',
            'financeiro': 'bg-emerald-50 text-emerald-600 border-emerald-100',
            'jurídico': 'bg-amber-50 text-amber-600 border-amber-100',
            'viabilidade': 'bg-rose-50 text-rose-600 border-rose-100',
            'infra': 'bg-sky-50 text-sky-600 border-sky-100',
            'geral': 'bg-slate-50 text-slate-600 border-slate-100'
        };
        const key = (name || '').toLowerCase();
        return mapping[key] || mapping['geral'];
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

    // --- VIEW: GESTÃO DE PROJETOS (New Gantt) ---
    renderCalendar(container) {
        const year = this.state.currentMonth.getFullYear();
        const month = this.state.currentMonth.getMonth();
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const colWidth = 40; // var(--gantt-day-width)
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Navigation Toolbar
        // Dynamic Legend: Get unique tracks from actual data
        const activeTracks = new Set();
        this.getFilteredData().forEach(item => {
            if (item.esteiras_analitico) {
                item.esteiras_analitico.forEach(t => activeTracks.add(t.esteira));
            }
        });
        const legendTracks = Array.from(activeTracks);

        // Fallback if no data
        if (legendTracks.length === 0) {
            ['Viabilidade', 'Jurídico', 'Financeiro', 'Carteira'].forEach(t => legendTracks.push(t));
        }

        const toolbar = document.createElement('div');
        toolbar.className = 'flex items-center justify-between mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200';
        toolbar.innerHTML = `
            <div class="flex items-center gap-4">
                <h2 class="text-lg font-bold text-slate-800 capitalize">${monthNames[month]} <span class="text-indigo-600 font-extrabold">${year}</span></h2>
                <div class="flex items-center bg-slate-100 rounded-lg p-1">
                    <button onclick="App.navMonth(-1)" class="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="App.navMonth(0)" class="px-3 py-1 text-xs font-bold hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all uppercase">Hoje</button>
                    <button onclick="App.navMonth(1)" class="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider overflow-x-auto max-w-[600px] hide-scrollbar">
                <div class="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded border border-slate-100 shrink-0">
                    <div class="w-3 h-3 bg-slate-200 border border-slate-300"></div> Feriado / Fim de Semana
                </div>
                ${legendTracks.map(trackName => {
            // Start finding config match
            const trackKeyMatch = Object.keys(this.esteirasConfig).find(k => k.toLowerCase() === trackName.toLowerCase()) || 'padrao';
            const config = this.esteirasConfig[trackKeyMatch] || { label: trackName, color: 'bg-slate-400' };
            return `<span class="flex items-center gap-1.5 shrink-0"><span class="w-2.5 h-2.5 rounded-full ${config.color}"></span> ${trackName}</span>`;
        }).join('')}
            </div>
        `;
        container.appendChild(toolbar);

        // 2. Gantt Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'gantt-wrapper fade-in flex flex-col h-full overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200';

        // 2.1 Header
        const header = document.createElement('div');
        header.className = 'gantt-header flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20';

        // Sidebar Header
        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = 'w-[300px] shrink-0 p-3 font-bold text-xs uppercase text-slate-500 border-r border-slate-200 flex items-center bg-slate-50';
        sidebarHeader.innerText = 'Projetos & Esteiras';
        header.appendChild(sidebarHeader);

        // Timeline Header
        const timelineHeader = document.createElement('div');
        timelineHeader.className = 'flex flex-1 overflow-hidden';
        let daysHtml = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isHoliday = WorkingHoursEngine.HOLIDAYS.includes(dateStr);
            const isToday = dateStr === todayStr;

            let classes = 'flex flex-col items-center justify-center h-12 border-r border-slate-100 shrink-0';
            if (isWeekend || isHoliday) classes += ' bg-slate-100 text-slate-400';
            if (isToday) classes += ' bg-indigo-50 text-indigo-600 font-bold';

            daysHtml += `
                <div class="${classes}" style="width: ${colWidth}px;">
                    <span class="text-[9px] uppercase">${dayNames[dateObj.getDay()]}</span>
                    <span class="text-sm leading-none">${d}</span>
                </div>
            `;
        }
        timelineHeader.innerHTML = `<div class="flex" id="gantt-header-track">${daysHtml}</div>`;
        header.appendChild(timelineHeader);
        wrapper.appendChild(header);

        // 2.2 Content Area
        const viewport = document.createElement('div');
        viewport.className = 'gantt-viewport flex flex-1 overflow-auto relative';

        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex flex-col min-w-full';

        // Background Grid
        const gridBackground = document.createElement('div');
        gridBackground.className = 'absolute inset-0 flex pointer-events-none z-0 ml-[300px] h-full';
        let gridHtml = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isHoliday = WorkingHoursEngine.HOLIDAYS.includes(dateStr);

            let bgClass = 'border-r border-slate-50 h-full shrink-0';
            if (isWeekend || isHoliday) bgClass += ' bg-slate-50/50 repeating-linear-gradient(45deg,transparent,transparent 5px,#f1f5f9 5px,#f1f5f9 10px)';

            gridHtml += `<div class="${bgClass}" style="width: ${colWidth}px;"></div>`;
        }
        gridBackground.innerHTML = gridHtml;
        viewport.appendChild(gridBackground);


        // 3. Process Data
        const groupedData = this.groupByClientAndSpe();

        let rowsHtml = '';

        groupedData.forEach(client => {
            // Render Client Header
            rowsHtml += `
                <div class="flex border-b border-slate-100 bg-slate-50/80 sticky left-0 z-10">
                    <div class="w-[300px] shrink-0 p-2 font-bold text-slate-700 text-sm flex items-center gap-2 border-r border-slate-200 pl-4">
                        <i class="fa-solid fa-building text-slate-400"></i> ${this.escapeHtml(client.name)}
                    </div>
                     <div class="flex-1"></div> 
                </div>
            `;

            client.spes.forEach(spe => {
                const isExpanded = this.state.expandedItems[spe.name] !== false;
                const speKey = this.escapeAttr(spe.name);

                // Data now available directly on SPE object due to groupByClientAndSpe fix
                const esteirasAnalitico = spe.esteiras_analitico || [];

                // SPE Header Row
                rowsHtml += `
                    <div class="flex border-b border-slate-100 hover:bg-slate-50 transition-colors group relative z-10">
                        <div class="w-[300px] shrink-0 p-2 pl-8 flex items-center justify-between border-r border-slate-200 bg-white sticky left-0 cursor-pointer" onclick="App.toggleAccordion('${speKey}')">
                            <span class="font-semibold text-slate-700 text-sm truncate" title="${this.escapeHtml(spe.name)}">${this.escapeHtml(spe.name)}</span>
                            <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-slate-400 text-xs"></i>
                        </div>
                        <div class="flex-1 relative h-10">
                        </div>
                    </div>
                `;

                if (isExpanded) {
                    if (esteirasAnalitico.length > 0) {
                        // Use Source of Truth
                        esteirasAnalitico.forEach(track => {
                            // Match config or use default
                            const trackKeyMatch = Object.keys(this.esteirasConfig).find(k => k.toLowerCase() === track.esteira.toLowerCase()) || 'padrao';
                            const trackConfig = this.esteirasConfig[trackKeyMatch] || { label: track.esteira, color: 'bg-slate-400', icon: 'fa-tasks', sla: 0 };

                            // Dates from Data (NO INVENTION)
                            const startDate = track.data_inicio;
                            const endDate = track.data_conclusao || track.data_previsao_entrega;
                            const isForecast = !track.data_conclusao;

                            if (!startDate && !endDate) return;

                            // Calculate Dates (Fallback logic for view bounds)
                            const startObj = new Date(startDate || endDate);
                            const endObj = new Date(endDate || startDate);

                            const monthStart = new Date(year, month, 1);
                            const monthEnd = new Date(year, month + 1, 0);

                            if (endObj < monthStart || startObj > monthEnd) return;

                            const renderStart = startObj < monthStart ? monthStart : startObj;
                            const renderEnd = endObj > monthEnd ? monthEnd : endObj;

                            const startDay = renderStart.getDate();
                            const distinctDays = Math.max(1, Math.ceil((renderEnd - renderStart) / (1000 * 60 * 60 * 24)) + 1);

                            const widthIdx = distinctDays;
                            const leftPos = (startDay - 1) * colWidth;
                            const widthPx = widthIdx * colWidth;

                            // Status Mapping
                            let colorClass = trackConfig.color;
                            const status = (track.status_esteira_detalhado || '').toLowerCase();

                            if (status.includes('conclu')) colorClass = 'bg-emerald-500';
                            else if (status.includes('bloq') || status.includes('suspen')) colorClass = 'bg-rose-500';
                            else if (status.includes('atras') || status.includes('risco')) colorClass = 'bg-amber-500';
                            else if (status.includes('pendente')) colorClass = 'bg-slate-400';
                            else colorClass = 'bg-indigo-500'; // Default active

                            // Render Track Row
                            rowsHtml += `
                                <div class="flex border-b border-dashed border-slate-200 hover:bg-slate-50/50 transition-colors h-10 relative z-0">
                                    <div class="w-[300px] shrink-0 p-2 pl-12 flex items-center gap-2 border-r border-slate-200 bg-white/50 sticky left-0 text-xs text-slate-500">
                                        <i class="fa-solid ${trackConfig.icon} opacity-50"></i> ${track.esteira}
                                    </div>
                                    <div class="flex-1 relative h-full">
                                        <div class="absolute top-2 h-6 rounded-md shadow-sm border border-white/20 text-white text-[10px] font-bold flex items-center px-2 truncate cursor-pointer hover:brightness-110 transition-all ${colorClass} ${isForecast ? 'opacity-75 border-dashed border-slate-400' : ''}"
                                             style="left: ${leftPos}px; width: ${Math.max(colWidth - 4, widthPx - 4)}px;"
                                             title="${track.esteira}: ${startDate} até ${endDate} (${track.status_esteira_detalhado})"
                                             onclick="App.openTrackEditor('${speKey}', '${track.esteira}')">
                                            ${isForecast ? '<i class="fa-solid fa-clock mr-1"></i>' : ''} 
                                            ${track.esteira}
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        // NO DATA AVAILABLE STATE - Do not invent dates
                        rowsHtml += `
                            <div class="flex border-b border-dashed border-slate-200 h-10 relative z-0">
                                <div class="w-[300px] shrink-0 p-2 pl-12 flex items-center gap-2 border-r border-slate-200 bg-white/50 sticky left-0 text-xs text-slate-400 italic">
                                    Sem dados de esteira
                                </div>
                                <div class="flex-1 relative h-full flex items-center pl-4">
                                    <span class="text-xs text-slate-300 italic">Nenhum dado analítico encontrado.</span>
                                </div>
                            </div>
                        `;
                    }
                }
            });
        });

        contentContainer.innerHTML = rowsHtml;
        viewport.appendChild(contentContainer);
        wrapper.appendChild(viewport);
        container.appendChild(wrapper);

        // Sync Scrolling
        timelineHeader.style.overflow = 'hidden';
        viewport.addEventListener('scroll', () => {
            timelineHeader.scrollLeft = viewport.scrollLeft;
        });
    },
    renderGanttBar(start, end, status, label, year, month, daysInMonth, isSub = false) {
        if (!start || !end) return '';

        const colWidth = 40;
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month, daysInMonth);

        // Clip to current month
        const displayStart = startDate < monthStart ? monthStart : startDate;
        const displayEnd = endDate > monthEnd ? monthEnd : endDate;

        if (displayStart > monthEnd || displayEnd < monthStart) return '';

        const startIdx = displayStart.getDate() - 1;
        const duration = (displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

        const left = startIdx * colWidth;
        const width = duration * colWidth;

        let colorClass = 'bg-indigo-500';
        if (status === 'sub') colorClass = 'bg-slate-300';
        else {
            const s = status.toLowerCase();
            if (s.includes('conclu')) colorClass = 'bg-emerald-500';
            else if (s.includes('bloq') || s.includes('suspen')) colorClass = 'bg-rose-500';
            else if (s.includes('atras') || s.includes('risco')) colorClass = 'bg-amber-500';
        }

        return `
    <div class="gantt-bar ${colorClass} ${isSub ? 'opacity-70' : ''}"
style = "left: ${left}px; width: ${width}px;"
title = "${label} (${start} até ${end})" >
    ${isSub ? '' : `<span class="px-2 truncate">${label}</span>`}
            </div>
    `;
    },

    toggleGanttRow(speName) {
        this.state.expandedItems[speName] = !this.state.expandedItems[speName];
        this.render();
    },

    goToSpeKickoff(speName, kickOffDate) {
        const date = new Date(kickOffDate + 'T00:00:00');
        const colWidth = 40;

        // Toggle month if different
        if (date.getMonth() !== this.state.currentMonth.getMonth() || date.getFullYear() !== this.state.currentMonth.getFullYear()) {
            this.state.currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            this.render();
        }

        // Wait for render and scroll
        setTimeout(() => {
            const timeline = document.getElementById('gantt-timeline');
            if (timeline) {
                const scrollPos = (date.getDate() - 2) * colWidth;
                timeline.scrollLeft = Math.max(0, scrollPos);

                // Visual Highlight on labels
                const labels = document.querySelectorAll('.gantt-row-label');
                labels.forEach(l => {
                    if (l.innerText.includes(speName)) {
                        l.classList.add('bg-indigo-50');
                        setTimeout(() => l.classList.remove('bg-indigo-50'), 2000);
                    }
                });
            }
        }, 150);
    },

    // Helper to group tasks when no esteira structure exists
    groupTasksIntoTracks(tasks) {
        const esteiras = {};
        tasks.forEach(t => {
            const e = t.esteira || 'Geral';
            if (!esteiras[e]) esteiras[e] = { esteira: e, tasks: [] };
            esteiras[e].tasks.push(t);
        });
        return Object.values(esteiras);
    },

    getMinDate(tasks, ...keys) {
        return tasks.reduce((min, t) => {
            for (let key of keys) {
                const s = t[key];
                if (s && (!min || s < min)) min = s;
            }
            return min;
        }, null);
    },

    getMaxDate(tasks, ...keys) {
        return tasks.reduce((max, t) => {
            for (let key of keys) {
                const s = t[key];
                if (s && (!max || s > max)) max = s;
            }
            return max;
        }, null);
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

        // Filter by KA
        if (this.state.filterKeyAccount) {
            data = data.filter(d => d.nome_do_key_account === this.state.filterKeyAccount);
        }

        // Filter by service (array-based matching)
        if (this.state.filterService) {
            const targetService = this.state.filterService;
            data = data.filter(d => {
                const servicos = d.servicos_contratados;
                if (Array.isArray(servicos)) {
                    return servicos.includes(targetService);
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
                id: n.id || n.task_id || `t - ${index} `,

                // Dados do Cliente/SPE
                razao_social_cliente: n.razao_social_cliente || n.cliente || 'Cliente Desconhecido',
                razao_social_da_spe: n.razao_social_da_spe || n.spe || n.razao_social_cliente || 'SPE Desconhecida',
                cnpj_da_spe: n.cnpj_da_spe || n.cnpj || '',

                // ERP/Sistema
                erp: n.erp || '',
                codigo_uau: parseInt(n.codigo_uau) || null,

                // Fase e Serviços
                fase_da_spe: n.fase_da_spe || n.fase || 'Não definida',
                tipologia_spe: n.tipologia_spe || n.tipologia || 'Não definida',
                servicos_contratados: n.servicos_contratados ? n.servicos_contratados.split(',').map(s => s.trim()) : [],
                sla_dias_uteis_padrao: parseInt(n.sla_dias_uteis_padrao || n.sla) || 5,

                // IDs Adicionais
                sonar_business_id: n.sonar_business_id || '',
                sonar_project_id: n.sonar_project_id || '',
                id_azo_ativo: n.id_azo_ativo || '',
                id_azo_operacao: n.id_azo_operacao || '',
                nome_do_key_account: n.nome_do_key_account || n.key_account || '',
                gerente_comercial: n.gerente_comercial || '',
                origem: n.origem || '',
                prazo_da_politica_de_pagamentos: n.prazo_da_politica_de_pagamentos || '',
                link_pasta: n.link_pasta || '',

                // Identificadores de Processo
                process_id: n.process_id || `PROC - ${index} `,
                task_id: n.task_id || `TASK - ${index} `,

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

            // Ensure services is always an array of trimmed strings
            let services = row.servicos_contratados || [];
            if (typeof services === 'string') {
                services = services.split(',').map(s => s.trim()).filter(s => s.length > 0);
            } else if (!Array.isArray(services)) {
                services = [];
            }

            return {
                ...row,
                servicos_contratados: services,
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
                const iso = `${parts[2]} -${parts[1].padStart(2, '0')} -${parts[0].padStart(2, '0')} `;
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
                msgDiv.innerHTML = `< i class="fa-solid fa-xmark mr-2" ></i > Erro: ${error.message} `;
            }
        };
        reader.readAsArrayBuffer(file);
    },

    updateSheetIndicator(type, sheetName, data) {
        const row = document.getElementById(`sheet - ${type} `);
        const countEl = document.getElementById(`sheet - ${type} -count`);
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
                console.error(`Erro ao processar ${type}: `, error);
                this.showToast(`Erro ao ler ${type} `, 'error');
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
            this.showToast(`Importados: ${result.stats.processos} processos, ${result.stats.tarefas} tarefas${orphanMsg} `, 'success');
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
            const processId = n.process_id || n.id || `PROC - ${idx} `;

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
                grupo_cliente: n.grupo_cliente || n.grupo || '', // NEW FIELD
                erp: n.erp || '',
                codigo_uau: parseInt(n.codigo_uau) || null,
                tipologia_spe: n.tipologia_spe || n.tipologia || 'Não definida',
                sonar_business_id: n.sonar_business_id || '',
                sonar_project_id: n.sonar_project_id || '',
                id_azo_ativo: n.id_azo_ativo || '',
                id_azo_operacao: n.id_azo_operacao || '',
                nome_do_key_account: n.nome_do_key_account || n.key_account || '',
                gerente_comercial: n.gerente_comercial || '',
                origem: n.origem || '',
                prazo_da_politica_de_pagamentos: n.prazo_da_politica_de_pagamentos || '',
                link_pasta: n.link_pasta || '',
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
            const dataInicio = this.parseExcelDate(n.data_inicio);
            const dataPrevisao = this.parseExcelDate(n.data_previsao_entrega);
            const dataConclusao = this.parseExcelDate(n.data_conclusao);
            const slaDias = parseInt(n.sla_esteira_dias || n.sla_total || n.sla) || null;

            // Calculate esteira status based on SLA
            let statusEsteira = n.status_esteira_detalhado || n.status_esteira || 'Em Andamento';
            const isCompleted = dataConclusao !== null;
            const isOverdue = !isCompleted && dataPrevisao && today > dataPrevisao;

            const track = {
                esteira_id: n.esteira_id || `EST - ${idx} `,
                process_id: processId,
                esteira: esteiraName,
                status_esteira_detalhado: statusEsteira,
                sla_esteira_dias: slaDias, // SLA in days for this track
                data_inicio: dataInicio,
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
                task_id: n.task_id || n.id || `TASK - ${idx} `,
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
                responsavel_direto_tags: n.responsavel_direto_tags || n.area || n.departamento || '',
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
                task.grupo_cliente = parent.grupo_cliente; // NEW FIELD
                task.razao_social_da_spe = parent.razao_social_da_spe;
                task.cnpj_da_spe = parent.cnpj_da_spe;
                task.fase_da_spe = parent.fase_da_spe;
                task.erp = parent.erp;
                task.codigo_uau = parent.codigo_uau;
                task.tipologia_spe = parent.tipologia_spe;
                task.sonar_business_id = parent.sonar_business_id;
                task.sonar_project_id = parent.sonar_project_id;
                task.id_azo_ativo = parent.id_azo_ativo;
                task.id_azo_operacao = parent.id_azo_operacao;
                task.nome_do_key_account = parent.nome_do_key_account;
                task.gerente_comercial = parent.gerente_comercial;
                task.origem = parent.origem;
                task.prazo_da_politica_de_pagamentos = parent.prazo_da_politica_de_pagamentos;
                task.link_pasta = parent.link_pasta;
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
        this.render();
    },

    // Navegação
    setView(view, params = {}) {
        this.state.currentView = view;
        this.state.routeParams = params;
        this.render();
    },

    filterPendenciasAndGo(speName) {
        this.state.filterPendenciasSpe = speName;
        this.setView('pendencias');
    },
    navMonth(dir) {
        if (dir === 0) {
            this.state.currentMonth = new Date();
        } else {
            this.state.currentMonth.setMonth(this.state.currentMonth.getMonth() + dir);
        }
        this.render();
    },


    // Filtros
    populateFilters() {
        // Client filter
        const clientSelect = document.getElementById('client-filter');
        if (clientSelect) {
            const clients = [...new Set(this.state.data.map(d => d.razao_social_cliente).filter(Boolean))].map(c => c.trim()).sort();
            clientSelect.innerHTML = '<option value="">Todos os Clientes</option>' + clients.map(c => `< option value = "${this.escapeAttr(c)}" > ${this.escapeHtml(c)}</option > `).join('');
        }

        // Populate Service Filter
        const services = this.extractUniqueServices();
        const serviceFilter = document.getElementById('service-filter');
        if (serviceFilter) {
            serviceFilter.innerHTML = '<option value="">Todos os Serviços</option>' +
                services.map(s => `< option value = "${this.escapeAttr(s)}" ${this.state.filterService === s ? 'selected' : ''}> ${this.escapeHtml(s)}</option > `).join('');
        }

        // Populate Key Account Filter
        const kas = [...new Set(this.state.data.map(d => d.nome_do_key_account).filter(Boolean))].map(k => k.trim()).sort();
        const kaFilter = document.getElementById('ka-filter');
        if (kaFilter) {
            kaFilter.innerHTML = '<option value="">Todos os KAs</option>' +
                kas.map(k => `< option value = "${this.escapeAttr(k)}" ${this.state.filterKeyAccount === k ? 'selected' : ''}> ${this.escapeHtml(k)}</option > `).join('');
        }
    },

    setOverviewFilter(filter) {
        this.state.overviewFilter = filter;
        this.render();
    },

    // Extract unique services from all data (Exclusively from process metadata)
    extractUniqueServices() {
        const servicesSet = new Set();
        const processedProcesses = new Set();

        this.state.data.forEach(item => {
            const pid = item.process_id;
            if (pid && !processedProcesses.has(pid)) {
                processedProcesses.add(pid);
                const servicos = item.servicos_contratados;
                if (Array.isArray(servicos)) {
                    servicos.forEach(s => {
                        if (typeof s === 'string') {
                            const trimmed = s.trim();
                            if (trimmed) servicesSet.add(trimmed);
                        }
                    });
                }
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

    onKeyAccountFilterChange(val) {
        this.state.filterKeyAccount = val;
        this.render();
    },

    renderSidebar() {
        const menu = document.getElementById('sidebar-menu-main');
        menu.innerHTML = `
            <li class="sidebar-section">ESTRATÉGICO</li>
            <li id="menu-carteira" class="sidebar-menu-item active" onclick="App.setView('carteira')">
                <i class="fa-solid fa-briefcase"></i> <span>Acompanhamento Geral</span>
            </li>
            <li id="menu-overview" class="sidebar-menu-item" onclick="App.setView('overview')">
                <i class="fa-solid fa-chart-pie"></i> <span>Painel Executivo</span>
            </li>
            <li id="menu-calendario" class="sidebar-menu-item" onclick="App.setView('calendario')">
                <i class="fa-solid fa-calendar-days"></i> <span>Gestão de Projetos</span>
            </li>
            
            <li class="sidebar-section">OPERAÇÃO</li>
            <li id="menu-gestao-operacional" class="sidebar-menu-item" onclick="App.setView('gestao-operacional')">
                <i class="fa-solid fa-clipboard-check"></i> <span>Gestão Operacional</span>
            </li>
            <li id="menu-gestao-processual" class="sidebar-menu-item" onclick="App.setView('gestao-processual')">
                <i class="fa-solid fa-microchip"></i> <span>Gestão Processual</span>
            </li>
            <li id="menu-pendencias" class="sidebar-menu-item" onclick="App.setView('pendencias')">
                <i class="fa-solid fa-exclamation-triangle"></i> <span>Pendências Críticas</span>
            </li>

            <li class="sidebar-section">FINANCEIRO</li>
            <li id="menu-faturamento" class="sidebar-menu-item" onclick="App.setView('faturamento')">
                <i class="fa-solid fa-file-invoice-dollar"></i> <span>Gestão de Faturamento</span>
            </li>

            <li class="sidebar-section">QUALIDADE</li>
            <li id="menu-entregaveis" class="sidebar-menu-item" onclick="App.setView('entregaveis')">
                <i class="fa-solid fa-clipboard-check"></i> <span>Gestão de Entregáveis</span>
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
            ` : ''
            }
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
        toast.className = `fixed bottom - 4 right - 4 ${colors[type]} text - white px - 4 py - 2 rounded - lg shadow - lg z - [200] fade -in `;
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
    },

    renderDailyHistory(container) {
        const journals = this.state.journals || {};
        const allEntries = [];

        Object.keys(journals).forEach(speName => {
            journals[speName].forEach(entry => {
                if (entry.type === 'DAILY_ACTION') {
                    allEntries.push({ ...entry, speName });
                }
            });
        });

        // Apply Filters
        const filterSpe = this.state.historyFilterSpe || '';
        const filterType = this.state.historyFilterType || '';
        const filterStatus = this.state.historyFilterStatus || '';
        const filterResp = this.state.historyFilterResp || '';
        const filterEsteira = this.state.historyFilterEsteira || '';
        const filterSearch = (this.state.historyFilterSearch || '').toLowerCase();

        const filtered = allEntries.filter(e => {
            if (filterSpe && e.speName !== filterSpe) return false;
            if (filterType && e.subType !== filterType) return false;
            if (filterStatus && (e.status === 'done' ? 'done' : 'todo') !== filterStatus) return false;
            if (filterResp && e.responsavel !== filterResp) return false;
            if (filterEsteira && e.esteira !== filterEsteira) return false;
            if (filterSearch && !e.text.toLowerCase().includes(filterSearch)) return false;
            return true;
        }).sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

        const spes = [...new Set(allEntries.map(e => e.speName))].sort();
        const responsibles = [...new Set(allEntries.map(e => e.responsavel).filter(Boolean))].sort();
        const esteiras = [...new Set(allEntries.map(e => e.esteira).filter(Boolean))].sort();

        container.innerHTML = `
    < div class="p-6 fade-in max-w-7xl mx-auto" >
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h2 class="text-2xl font-extrabold text-slate-800 tracking-tight">Central de Registros</h2>
                        <p class="text-slate-500 text-sm mt-1">Histórico global de ações e relatos das dailies operacionais.</p>
                    </div>
                </div>

                <!--Filters -->
                <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
                    <div class="flex-1 min-w-[200px]">
                        <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Buscar no Texto</label>
                        <div class="relative">
                            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input 
                                type="text" 
                                placeholder="Filtrar por descrição..." 
                                value="${this.escapeAttr(filterSearch)}"
                                oninput="App.updateHistoryFilter('search', this.value)"
                                class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/30"
                            >
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Operação / SPE</label>
                        <select onchange="App.updateHistoryFilter('spe', this.value)" class="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[150px]">
                            <option value="">Todas as SPEs</option>
                            ${spes.map(s => `<option value="${this.escapeAttr(s)}" ${filterSpe === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Área / Esteira</label>
                        <select onchange="App.updateHistoryFilter('esteira', this.value)" class="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[150px]">
                            <option value="">Todas as Áreas</option>
                            ${esteiras.map(est => `<option value="${this.escapeAttr(est)}" ${filterEsteira === est ? 'selected' : ''}>${this.escapeHtml(est)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Responsável</label>
                        <select onchange="App.updateHistoryFilter('responsavel', this.value)" class="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[150px]">
                            <option value="">Todos</option>
                            ${responsibles.map(r => `<option value="${this.escapeAttr(r)}" ${filterResp === r ? 'selected' : ''}>${this.escapeHtml(r)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Tipo</label>
                        <select onchange="App.updateHistoryFilter('type', this.value)" class="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                            <option value="">Todos</option>
                            <option value="todo" ${filterType === 'todo' ? 'selected' : ''}>Ação (To-do)</option>
                            <option value="report" ${filterType === 'report' ? 'selected' : ''}>Relato (Report)</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Status</label>
                        <select onchange="App.updateHistoryFilter('status', this.value)" class="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                            <option value="">Todos</option>
                            <option value="todo" ${filterStatus === 'todo' ? 'selected' : ''}>Pendente</option>
                            <option value="done" ${filterStatus === 'done' ? 'selected' : ''}>Concluído</option>
                        </select>
                    </div>
                </div>

                <!--Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200">
                        <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32 border-r border-slate-100">Data</th>
                        <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-56 border-r border-slate-100">Operação (SPE)</th>
                        <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36 border-r border-slate-100">Responsável</th>
                        <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição Detalhada / Relato Situacional</th>
                        <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36 border-l border-slate-100">Prazo</th>
                        <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36 text-center">Controle</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${filtered.map(entry => `
                                    <tr class="hover:bg-slate-50/50 transition-all">
                                        <td class="px-6 py-4 text-sm text-slate-500 border-r border-slate-50">${WorkingHoursEngine.formatDate(entry.date)}</td>
                                        <td class="px-6 py-4 border-r border-slate-50">
                                            <button onclick="App.setView('company', { spe: '${this.escapeAttr(entry.speName)}' })" class="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                                ${this.escapeHtml(entry.speName)}
                                            </button>
                                        </td>
                                        <td class="px-6 py-4 border-r border-slate-50">
                                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 tracking-tight uppercase">
                                                <i class="fa-solid fa-user-circle mr-1 text-slate-400"></i> ${this.escapeHtml(entry.responsavel || 'Sistema')}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="flex flex-col gap-1.5">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${this.getEsteiraColorClass(entry.esteira)} uppercase shadow-sm">
                                                        ${entry.subType === 'report' ? 'Relato' : entry.esteira || 'Geral'}
                                                    </span>
                                                    ${entry.subType === 'report' ? '<span class="text-[8px] font-extrabold text-emerald-500 bg-emerald-50 px-1 rounded border border-emerald-100 uppercase tracking-tighter">Informativo</span>' : ''}
                                                </div>
                                                <p class="text-sm text-slate-700 leading-snug max-w-2xl ${entry.status === 'done' ? 'line-through opacity-40 italic' : ''}">
                                                    ${this.escapeHtml(entry.text)}
                                                </p>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 border-l border-slate-50">
                                            ${entry.prazo ? `
                                                <div class="flex flex-col">
                                                    <span class="text-[11px] font-bold text-slate-700">
                                                        <i class="fa-solid fa-calendar-day mr-1.5 text-slate-300"></i> ${WorkingHoursEngine.formatDate(entry.prazo)}
                                                    </span>
                                                    <!-- Optional: indicate if overdue -->
                                                </div>
                                            ` : '<span class="text-slate-300 text-xs italic">N/A</span>'}
                                        </td>
                                        <td class="px-6 py-4 text-center">
                                            ${entry.subType === 'todo' ? `
                                                <button 
                                                    onclick="App.toggleDailyAction('${this.escapeAttr(entry.speName)}', ${entry.id})"
                                                    class="inline-flex items-center justify-center w-10 h-10 rounded-full border transition-all ${entry.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white shadow shadow-emerald-200/50' : 'bg-white text-slate-300 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30'}"
                                                    title="${entry.status === 'done' ? 'Marcar como Pendente' : 'Marcar como Concluído'}"
                                                >
                                                    <i class="fa-solid ${entry.status === 'done' ? 'fa-check' : 'fa-circle-check text-lg'}"></i>
                                                </button>
                                            ` : '<i class="fa-solid fa-info-circle text-slate-200 text-lg" title="Relato Informativo"></i>'}
                                        </td>
                                    </tr>
                                `).join('') || `
                                    <tr>
                                        <td colspan="6" class="px-6 py-20 text-center">
                                            <div class="flex flex-col items-center opacity-40">
                                                <i class="fa-solid fa-folder-open text-5xl mb-4"></i>
                                                <p class="text-lg font-medium italic">Nenhum registro encontrado.</p>
                                                <span class="text-sm mt-1">Tente ajustar seus filtros de busca.</span>
                                            </div>
                                        </td>
                                    </tr>
                                `}
                </tbody>
            </table>
        </div>
    </div>
            </div >
    `;
    },

    // Placeholder View for Future Features
    renderPlaceholderView(container, title, icon, description) {
        container.innerHTML = `
    < div class="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in" >
                <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <i class="fa-solid ${icon} text-4xl text-slate-400"></i>
                </div>
                <h2 class="text-3xl font-bold text-slate-700 mb-3">${title}</h2>
                <p class="text-slate-500 max-w-md text-lg leading-relaxed mb-8">${description}</p>
                
                <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 max-w-sm w-full mx-auto flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
                        <i class="fa-solid fa-helmet-safety"></i>
                    </div>
                    <div class="text-left">
                        <p class="text-xs font-bold text-indigo-800 uppercase tracking-wide">Em Desenvolvimento</p>
                        <p class="text-xs text-indigo-600">Esta funcionalidade estará disponível na próxima versão do sistema.</p>
                    </div>
                </div>
                
                <button onclick="window.history.back()" class="mt-12 text-slate-400 hover:text-slate-600 font-semibold text-sm flex items-center gap-2 transition-colors">
                    <i class="fa-solid fa-arrow-left"></i> Voltar
                </button>
            </div >
    `;
    },

    updateHistoryFilter(field, value) {
        if (!this.state.historyFilters) this.state.historyFilters = {};
        if (field === 'spe') this.state.historyFilterSpe = value;
        if (field === 'type') this.state.historyFilterType = value;
        if (field === 'status') this.state.historyFilterStatus = value;
        if (field === 'search') this.state.historyFilterSearch = value;
        if (field === 'responsavel') this.state.historyFilterResp = value;
        if (field === 'esteira') this.state.historyFilterEsteira = value;
        this.render();
    },

    getEsteiraColor(name) {
        const map = { 'Viabilidade': '#3b82f6', 'Jurídico': '#8b5cf6', 'Financeiro': '#10b981', 'Engenharia': '#f59e0b', 'Fiscal': '#ef4444' };
        return map[name] || '#64748b';
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());