// Estado global
let transactions = [];
let trfData = [];
let extratoBancario = [];
let kpis = null;

// Elementos DOM (serão inicializados quando o DOM estiver pronto)
let fileInput, dropZone, fileText, processBtn, uploadStatus, fileTypeSelect;

// Inicializar elementos DOM
function initDOMElements() {
    fileInput = document.getElementById('fileInput');
    dropZone = document.getElementById('dropZone');
    fileText = document.getElementById('fileText');
    processBtn = document.getElementById('processBtn');
    uploadStatus = document.getElementById('uploadStatus');
    fileTypeSelect = document.getElementById('fileType');
    
    if (!fileInput || !dropZone || !fileText || !processBtn || !uploadStatus || !fileTypeSelect) {
        console.error('❌ Alguns elementos DOM não foram encontrados:', {
            fileInput: !!fileInput,
            dropZone: !!dropZone,
            fileText: !!fileText,
            processBtn: !!processBtn,
            uploadStatus: !!uploadStatus,
            fileTypeSelect: !!fileTypeSelect
        });
        return false;
    }
    console.log('✅ Todos os elementos DOM encontrados');
    return true;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando aplicação...');
    
    // Inicializar elementos DOM
    if (!initDOMElements()) {
        console.error('❌ Falha ao inicializar elementos DOM');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'background: #ef4444; color: white; padding: 2rem; margin: 2rem; border-radius: 0.5rem; text-align: center;';
        errorDiv.innerHTML = '<h2>❌ Erro ao inicializar aplicação</h2><p>Alguns elementos da interface não foram encontrados.</p><p>Recarregue a página (F5).</p>';
        document.body.appendChild(errorDiv);
        return;
    }
    
    console.log('✅ Elementos DOM encontrados');
    initTabs();
    initFileUpload();
    updateUI();
    console.log('✅ Aplicação inicializada');
});

// Tabs
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Atualizar botões
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Atualizar panes
            tabPanes.forEach(p => p.classList.remove('active'));
            const targetPane = document.getElementById(`${targetTab}-tab`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            // Atualizar conteúdo se necessário
            if (targetTab === 'kpis') updateKPIs();
            if (targetTab === 'resumo') updateResumo();
            if (targetTab === 'conciliacao') updateConciliacao();
            if (targetTab === 'comissoes') updateComissoes();
            if (targetTab === 'reservas') updateReservas();
            if (targetTab === 'prazos') updatePrazos();
            if (targetTab === 'faturas') updateFaturas();
            if (targetTab === 'extrato') updateExtrato();
            if (targetTab === 'conciliacao-detalhada') updateConciliacaoDetalhada();
        });
    });
}

// File Upload
function initFileUpload() {
    console.log('📤 Inicializando upload...');
    
    try {
        // Click no drop zone
        dropZone.addEventListener('click', () => {
            console.log('📁 Drop zone clicado');
            fileInput.click();
        });
        
        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '#3b82f6';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '#475569';
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '#475569';
            
            const files = e.dataTransfer.files;
            console.log('📦 Ficheiro arrastado:', files.length, 'ficheiros');
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            console.log('📁 Ficheiro selecionado:', e.target.files.length);
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
        
        // Process button
        processBtn.addEventListener('click', () => {
            console.log('🔄 Botão processar clicado');
            processFile();
        });
        
        console.log('✅ Upload inicializado');
    } catch (error) {
        console.error('❌ Erro ao inicializar upload:', error);
        showError(`Erro ao inicializar upload: ${error.message}`);
    }
}

function handleFileSelect(file) {
    console.log('📄 Ficheiro selecionado:', file.name, 'Tamanho:', file.size, 'bytes', 'Tipo:', file.type);
    
    if (!file) {
        console.error('❌ Ficheiro inválido');
        showError('Ficheiro inválido');
        return;
    }
    
    try {
        fileText.textContent = file.name;
        processBtn.disabled = false;
        uploadStatus.innerHTML = '';
        
        // Guardar ficheiro para processar
        fileInput.selectedFile = file;
        
        console.log('✅ Ficheiro preparado para processamento');
    } catch (error) {
        console.error('❌ Erro ao selecionar ficheiro:', error);
        showError(`Erro: ${error.message}`);
    }
}

function processFile() {
    console.log('🔄 Iniciando processamento de ficheiro...');
    
    const file = fileInput.selectedFile || fileInput.files[0];
    if (!file) {
        console.error('❌ Nenhum ficheiro selecionado');
        showError('Nenhum ficheiro selecionado.');
        return;
    }
    
    console.log('📄 Processando:', file.name, 'Tamanho:', file.size);
    
    // Verificar extensão do ficheiro
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidFile) {
        showError('Formato de ficheiro não suportado. Use XLSX, XLS ou CSV.');
        processBtn.disabled = false;
        return;
    }
    
    const fileType = fileTypeSelect.value;
    processBtn.disabled = true;
    uploadStatus.innerHTML = '<div class="loading">A processar ficheiro...</div>';
    
    // Verificar se as bibliotecas estão carregadas
    if (!fileName.endsWith('.csv') && typeof XLSX === 'undefined') {
        showError('Biblioteca XLSX não está carregada. Por favor, recarregue a página.');
        processBtn.disabled = false;
        return;
    }
    
    if (fileName.endsWith('.csv') && typeof Papa === 'undefined') {
        showError('Biblioteca PapaParse não está carregada. Por favor, recarregue a página.');
        processBtn.disabled = false;
        return;
    }
    
    try {
        const reader = new FileReader();
        
        reader.onerror = (error) => {
            console.error('❌ Erro ao ler ficheiro:', error);
            showError('Erro ao ler ficheiro. Verifique se o ficheiro não está corrompido.');
            processBtn.disabled = false;
        };
        
        reader.onload = (e) => {
            console.log('✅ Ficheiro lido com sucesso');
            try {
                const data = e.target.result;
                console.log('📊 Dados carregados, tamanho:', data.length || data.byteLength);
                let parsedData;
                
                // Verificar se é CSV
                if (file.name.toLowerCase().endsWith('.csv')) {
                    // CSV - usar PapaParse do CDN
                    if (typeof Papa === 'undefined') {
                        throw new Error('PapaParse não está carregado. Por favor, recarregue a página.');
                    }
                    const result = Papa.parse(data, { 
                        header: true, 
                        skipEmptyLines: true,
                        encoding: 'UTF-8'
                    });
                    parsedData = result.data.filter(row => Object.keys(row).length > 0);
                } else {
                    // Excel (XLSX, XLS) - usar XLSX do CDN
                    if (typeof XLSX === 'undefined') {
                        throw new Error('XLSX não está carregado. Por favor, recarregue a página e aguarde o carregamento completo.');
                    }
                    
                    try {
                        // Determinar tipo de dados
                        let readType;
                        let readData = data;
                        
                        // Se for ArrayBuffer, usar 'array'
                        if (data instanceof ArrayBuffer) {
                            readType = 'array';
                            readData = data;
                            console.log('📖 Lendo Excel como ArrayBuffer');
                        } else if (typeof data === 'string') {
                            readType = 'binary';
                            readData = data;
                            console.log('📖 Lendo Excel como Binary String');
                        } else {
                            // Tentar converter para ArrayBuffer
                            console.log('📖 Tentando converter dados...');
                            readType = 'array';
                            readData = data;
                        }
                        
                        console.log('📖 Lendo Excel, tipo:', readType, 'tamanho:', readData.byteLength || readData.length);
                        const workbook = XLSX.read(readData, { 
                            type: readType,
                            cellDates: true,
                            cellNF: false,
                            cellText: false
                        });
                        
                        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                            throw new Error('O ficheiro Excel não contém folhas válidas.');
                        }
                        
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        
                        if (!worksheet) {
                            throw new Error('Não foi possível ler a primeira folha do ficheiro.');
                        }
                        
                        parsedData = XLSX.utils.sheet_to_json(worksheet, { 
                            raw: false,
                            defval: '',
                            blankrows: false
                        });
                        
                        if (!parsedData || parsedData.length === 0) {
                            throw new Error('O ficheiro Excel está vazio ou não contém dados válidos.');
                        }
                        
                    } catch (xlsxError) {
                        throw new Error(`Erro ao processar ficheiro Excel: ${xlsxError.message}`);
                    }
                }
                
                console.log('📊 Dados parseados:', parsedData.length, 'linhas');
                
                // Normalizar dados
                let normalized;
                if (fileType === 'transactions') {
                    console.log('🔄 Normalizando transações...');
                    normalized = normalizeTransactions(parsedData);
                    console.log('✅ Transações normalizadas:', normalized.length);
                    transactions = transactions.concat(normalized);
                    showSuccess(`Processadas ${normalized.length} transações. Total: ${transactions.length}`);
                } else if (fileType === 'trf') {
                    console.log('🔄 Normalizando TRF...');
                    normalized = normalizeTRF(parsedData);
                    console.log('✅ TRF normalizado:', normalized.length);
                    trfData = trfData.concat(normalized);
                    showSuccess(`Processadas ${normalized.length} transferências. Total: ${trfData.length}`);
                } else if (fileType === 'extrato') {
                    console.log('🔄 Normalizando extrato...');
                    normalized = normalizeExtrato(parsedData);
                    console.log('✅ Extrato normalizado:', normalized.length);
                    extratoBancario = extratoBancario.concat(normalized);
                    showSuccess(`Processadas ${normalized.length} linhas do extrato. Total: ${extratoBancario.length}`);
                }
                
                // Recalcular KPIs
                console.log('📊 Recalculando KPIs...');
                calculateKPIs();
                updateUI();
                console.log('✅ Processamento concluído com sucesso!');
                
            } catch (error) {
                console.error('❌ Erro ao processar ficheiro:', error);
                console.error('Stack trace:', error.stack);
                showError(`Erro ao processar: ${error.message}. Verifique a consola para mais detalhes.`);
            } finally {
                processBtn.disabled = false;
                fileText.textContent = 'Clique para selecionar ou arraste o ficheiro';
                fileInput.value = '';
            }
        };
        
        // Ler ficheiro no formato correto
        if (file.name.toLowerCase().endsWith('.csv')) {
            console.log('📖 Lendo como CSV...');
            reader.readAsText(file, 'UTF-8');
        } else {
            // Para Excel (XLSX, XLS) - usar ArrayBuffer (mais compatível)
            console.log('📖 Lendo como Excel (ArrayBuffer)...');
            reader.readAsArrayBuffer(file);
        }
        
    } catch (error) {
        showError(`Erro: ${error.message}`);
        processBtn.disabled = false;
    }
}

function normalizeTransactions(data) {
    // Normalizar nomes de colunas
    const columnMap = {
        'Data Criao': 'Data Criação',
        'Data Criação': 'Data Criação',
        'DÃ©bito': 'Débito',
        'Débito': 'Débito',
        'CrÃ©dito': 'Crédito',
        'Crédito': 'Crédito',
        'DescriÃ§Ã£o': 'Descrição',
        'Descrição': 'Descrição',
        'NÃº Pedido': 'Nº Pedido',
        'Nº Pedido': 'Nº Pedido',
        'Número da fatura': 'Nº da fatura',
        'Número da transação': 'Nº da transação',
    };
    
    return data.map(row => {
        const normalized = {};
        
        // Aplicar mapeamento de colunas
        for (const [oldKey, newKey] of Object.entries(columnMap)) {
            if (row[oldKey] !== undefined) {
                normalized[newKey] = row[oldKey];
            }
        }
        
        // Copiar todas as colunas restantes
        Object.keys(row).forEach(key => {
            if (!normalized[key] && !columnMap[key]) {
                normalized[key] = row[key];
            }
        });
        
        // Converter valores numéricos
        ['Crédito', 'Débito', 'Valor'].forEach(col => {
            if (normalized[col] !== undefined && normalized[col] !== null && normalized[col] !== '') {
                normalized[col] = parseFloat(String(normalized[col]).replace(',', '.')) || 0;
            } else {
                normalized[col] = 0;
            }
        });
        
        // Calcular real
        normalized.real = (normalized.Crédito || 0) - (normalized.Débito || 0);
        
        // Normalizar datas
        ['Data Criação', 'Data do ciclo de faturamento'].forEach(col => {
            if (normalized[col]) {
                const dateStr = String(normalized[col]).split(' - ')[0].trim();
                normalized[col] = dateStr;
            }
        });
        
        return normalized;
    }).filter(row => row.Tipo || row['Ciclo Pagamento']); // Filtrar linhas vazias
}

function normalizeTRF(data) {
    return data.map(row => {
        const normalized = {};
        
        // Tentar mapear colunas comuns
        const colMap = {
            'data': 'data',
            'date': 'data',
            'Data': 'data',
            'valor': 'valor',
            'amount': 'valor',
            'importe': 'valor',
            'Valor': 'valor',
            'referencia': 'referencia',
            'ref': 'referencia',
            'referência': 'referencia',
            'descricao': 'descricao',
            'descrição': 'descricao',
            'description': 'descricao'
        };
        
        Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase();
            for (const [pattern, mapped] of Object.entries(colMap)) {
                if (lowerKey.includes(pattern)) {
                    normalized[mapped] = row[key];
                    break;
                }
            }
        });
        
        // Converter data
        if (normalized.data) {
            const dateStr = String(normalized.data).split(' ')[0];
            normalized.data = dateStr;
        }
        
        // Converter valor
        if (normalized.valor !== undefined && normalized.valor !== null && normalized.valor !== '') {
            normalized.valor = parseFloat(String(normalized.valor).replace(',', '.')) || 0;
        } else {
            normalized.valor = 0;
        }
        
        normalized.referencia = normalized.referencia || '';
        normalized.descricao = normalized.descricao || '';
        
        return normalized;
    }).filter(row => row.data && row.valor !== 0); // Filtrar linhas vazias
}

function normalizeExtrato(data) {
    return data.map(row => {
        const normalized = {};
        
        // Tentar mapear colunas comuns de extratos bancários
        const colMap = {
            'data': ['data', 'date', 'Data', 'DATA', 'Data Movimento', 'Data Movimento'],
            'valor': ['valor', 'amount', 'importe', 'Valor', 'VALOR', 'Importe', 'Montante'],
            'descricao': ['descricao', 'description', 'Descrição', 'DESCRIÇÃO', 'Descrição Movimento', 'Concepto'],
            'saldo': ['saldo', 'balance', 'Saldo', 'SALDO', 'Saldo Contabilístico'],
            'referencia': ['referencia', 'ref', 'referência', 'Referência', 'REFERÊNCIA', 'Número Movimento'],
            'tipo': ['tipo', 'type', 'Tipo', 'TIPO', 'Tipo Movimento'],
            'categoria': ['categoria', 'category', 'Categoria', 'CATEGORIA']
        };
        
        Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase().trim();
            for (const [mapped, patterns] of Object.entries(colMap)) {
                if (patterns.some(p => lowerKey.includes(p.toLowerCase()))) {
                    normalized[mapped] = row[key];
                    break;
                }
            }
            // Se não encontrou mapeamento, copiar como está
            if (!Object.values(colMap).some(patterns => patterns.some(p => lowerKey.includes(p.toLowerCase())))) {
                normalized[key] = row[key];
            }
        });
        
        // Converter data
        if (normalized.data) {
            const dateStr = String(normalized.data).split(' ')[0].trim();
            normalized.data = dateStr;
        }
        
        // Converter valor e saldo
        ['valor', 'saldo'].forEach(col => {
            if (normalized[col] !== undefined && normalized[col] !== null && normalized[col] !== '') {
                const val = String(normalized[col]).replace(/[^\d.,-]/g, '').replace(',', '.');
                normalized[col] = parseFloat(val) || 0;
            } else {
                normalized[col] = 0;
            }
        });
        
        normalized.descricao = normalized.descricao || '';
        normalized.referencia = normalized.referencia || '';
        normalized.tipo = normalized.tipo || '';
        normalized.categoria = normalized.categoria || '';
        
        return normalized;
    }).filter(row => row.data && (row.valor !== 0 || row.saldo !== 0)); // Filtrar linhas vazias
}

function calculateKPIs() {
    if (transactions.length === 0) {
        kpis = null;
        return;
    }
    
    console.log('Calculando KPIs...', transactions.length, 'transações');
    
    // Debug: Verificar colunas disponíveis
    if (transactions.length > 0) {
        const sample = transactions[0];
        console.log('Colunas disponíveis na primeira transação:', Object.keys(sample));
        const produtosComSKU = transactions.filter(t => {
            const sku = t['SKU da oferta'] || t['SKU'] || t['SKU da Oferta'] || t['Sku'];
            return sku && sku !== '' && sku !== 'N/A';
        });
        console.log('Transações com SKU:', produtosComSKU.length);
    }
    
    // Prazos (apenas "Valor do pedido")
    const items = transactions.filter(t => 
        t.Tipo && t.Tipo.toLowerCase() === 'valor do pedido' &&
        t['Data Criação'] && t['Data do ciclo de faturamento']
    );
    
    const prazos = items.map(item => {
        const dataCriacao = new Date(item['Data Criação'].split('/').reverse().join('-'));
        const dataCiclo = new Date(item['Data do ciclo de faturamento'].split('/').reverse().join('-'));
        const diff = Math.floor((dataCiclo - dataCriacao) / (1000 * 60 * 60 * 24));
        return diff;
    }).filter(d => !isNaN(d) && d >= 0);
    
    const prazoMedio = prazos.length > 0 ? prazos.reduce((a, b) => a + b, 0) / prazos.length : 0;
    const prazoMin = prazos.length > 0 ? Math.min(...prazos) : 0;
    const prazoMax = prazos.length > 0 ? Math.max(...prazos) : 0;
    
    // Comissões
    const comissoesAcum = transactions.filter(t => 
        t.Tipo && /taxa|comiss/i.test(t.Tipo)
    ).reduce((sum, t) => sum + (t.Débito || 0), 0);
    
    const impComissoesAcum = transactions.filter(t => 
        t.Tipo && /imposto sobre.*(taxa|comiss)/i.test(t.Tipo)
    ).reduce((sum, t) => sum + (t.Débito || 0), 0);
    
    // Último ciclo (declarar uma vez no início)
    const ultimoCiclo = getUltimoCiclo();
    const transacoesUltimoCiclo = ultimoCiclo ? 
        transactions.filter(t => t['Ciclo Pagamento'] === ultimoCiclo) : [];
    
    const comissoesUlt = transacoesUltimoCiclo.filter(t => 
        t.Tipo && /taxa|comiss/i.test(t.Tipo)
    ).reduce((sum, t) => sum + (t.Débito || 0), 0);
    
    const impComissoesUlt = transacoesUltimoCiclo.filter(t => 
        t.Tipo && /imposto sobre.*(taxa|comiss)/i.test(t.Tipo)
    ).reduce((sum, t) => sum + (t.Débito || 0), 0);
    
    // Reembolsos
    const reembolsosAcum = transactions.filter(t => 
        t.Tipo && /reembolso/i.test(t.Tipo)
    ).reduce((sum, t) => sum + Math.abs(t.real || 0), 0);
    
    const reembolsosUlt = transacoesUltimoCiclo.filter(t => 
        t.Tipo && /reembolso/i.test(t.Tipo)
    ).reduce((sum, t) => sum + Math.abs(t.real || 0), 0);
    
    // Reserva
    const reservaSaldo = transactions.filter(t => 
        (t.Tipo && /manual/i.test(t.Tipo)) &&
        (t.Descrição && /reserv|reten|hold|escrow/i.test(t.Descrição))
    ).reduce((sum, t) => sum + (t.real || 0), 0);
    
    // Pedidos e produtos
    const pedidosRecebidos = new Set(
        transactions.filter(t => t.Tipo && t.Tipo.toLowerCase() === 'valor do pedido' && t['Nº Pedido'])
            .map(t => t['Nº Pedido'])
    ).size;
    
    const produtosVendidos = transactions.filter(t => 
        t.Tipo && t.Tipo.toLowerCase() === 'valor do pedido' && t['SKU da oferta']
    ).length;
    
    // Produto mais vendido (histórico)
    const produtosHist = {};
    transactions.filter(t => {
        if (!t.Tipo || t.Tipo.toLowerCase() !== 'valor do pedido') return false;
        // Tentar encontrar SKU em diferentes colunas possíveis
        const sku = t['SKU da oferta'] || t['SKU'] || t['SKU da Oferta'] || t['Sku'] || '';
        return sku && sku !== '' && sku !== 'N/A';
    }).forEach(t => {
        const sku = (t['SKU da oferta'] || t['SKU'] || t['SKU da Oferta'] || t['Sku'] || 'N/A').toString().trim();
        const categoria = (t['Rótulo da categoria'] || t['Rótulo da Categoria'] || t['Categoria'] || t['categoria'] || 'N/A').toString().trim();
        
        if (!produtosHist[sku] || sku === 'N/A') {
            if (sku !== 'N/A') {
                produtosHist[sku] = {
                    sku: sku,
                    categoria: categoria,
                    quantidade: 0,
                    valor: 0
                };
            } else {
                return; // Pular se não tiver SKU válido
            }
        }
        produtosHist[sku].quantidade += 1;
        produtosHist[sku].valor += Math.abs(t.real || 0);
    });
    
    const produtoMaisVendidoHist = Object.keys(produtosHist).length > 0 
        ? Object.values(produtosHist).sort((a, b) => b.quantidade - a.quantidade)[0] 
        : null;
    
    console.log('Produto mais vendido (histórico):', produtoMaisVendidoHist);
    
    // Produto mais vendido (último ciclo) - usar transacoesUltimoCiclo já calculado acima
    const produtosUlt = {};
    transacoesUltimoCiclo.filter(t => {
        if (!t.Tipo || t.Tipo.toLowerCase() !== 'valor do pedido') return false;
        // Tentar encontrar SKU em diferentes colunas possíveis
        const sku = t['SKU da oferta'] || t['SKU'] || t['SKU da Oferta'] || t['Sku'] || '';
        return sku && sku !== '' && sku !== 'N/A';
    }).forEach(t => {
        const sku = (t['SKU da oferta'] || t['SKU'] || t['SKU da Oferta'] || t['Sku'] || 'N/A').toString().trim();
        const categoria = (t['Rótulo da categoria'] || t['Rótulo da Categoria'] || t['Categoria'] || t['categoria'] || 'N/A').toString().trim();
        
        if (!produtosUlt[sku] || sku === 'N/A') {
            if (sku !== 'N/A') {
                produtosUlt[sku] = {
                    sku: sku,
                    categoria: categoria,
                    quantidade: 0,
                    valor: 0
                };
            } else {
                return; // Pular se não tiver SKU válido
            }
        }
        produtosUlt[sku].quantidade += 1;
        produtosUlt[sku].valor += Math.abs(t.real || 0);
    });
    
    const produtoMaisVendidoUlt = Object.keys(produtosUlt).length > 0 
        ? Object.values(produtosUlt).sort((a, b) => b.quantidade - a.quantidade)[0] 
        : null;
    
    console.log('Produto mais vendido (último ciclo):', produtoMaisVendidoUlt);
    console.log('Total produtos históricos:', Object.keys(produtosHist).length);
    console.log('Total produtos último ciclo:', Object.keys(produtosUlt).length);
    
    kpis = {
        prazos: {
            prazo_medio_dias: prazoMedio,
            prazo_min_dias: prazoMin,
            prazo_max_dias: prazoMax
        },
        comissoes_acum: {
            comissoes: comissoesAcum,
            imposto: impComissoesAcum
        },
        comissoes_ult: {
            comissoes: comissoesUlt,
            imposto: impComissoesUlt
        },
        reembolsos_acum: { total: reembolsosAcum },
        reembolsos_ult: { total: reembolsosUlt },
        reserva_saldo: reservaSaldo,
        reserva_ult_ciclo: ultimoCiclo,
        pedidos_recebidos: pedidosRecebidos,
        produtos_vendidos: produtosVendidos,
        produto_mais_vendido_hist: produtoMaisVendidoHist,
        produto_mais_vendido_ult: produtoMaisVendidoUlt
    };
}

function getUltimoCiclo() {
    const ciclos = [...new Set(transactions.map(t => t['Ciclo Pagamento']).filter(Boolean))];
    if (ciclos.length === 0) return null;
    
    // Ordenar por data do ciclo
    const ciclosComData = ciclos.map(ciclo => {
        const transacoes = transactions.filter(t => t['Ciclo Pagamento'] === ciclo);
        const datas = transacoes.map(t => {
            if (!t['Data do ciclo de faturamento']) return null;
            const dateStr = String(t['Data do ciclo de faturamento']).split(' - ')[0].trim();
            return new Date(dateStr.split('/').reverse().join('-'));
        }).filter(d => !isNaN(d.getTime()));
        
        return {
            ciclo,
            maxDate: datas.length > 0 ? new Date(Math.max(...datas)) : null
        };
    }).filter(c => c.maxDate);
    
    ciclosComData.sort((a, b) => b.maxDate - a.maxDate);
    return ciclosComData.length > 0 ? ciclosComData[0].ciclo : null;
}

function updateUI() {
    updateUploadStats();
    updateKPIs();
    updateResumo();
    updateConciliacao();
    updateComissoes();
    updateReservas();
    updatePrazos();
    updateFaturas();
    updateExtrato();
    updateConciliacaoDetalhada();
}

function updateUploadStats() {
    const container = document.getElementById('uploadStats');
    if (!kpis) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="stat-card blue">
            <div class="label">Total Pedidos</div>
            <div class="value">${kpis.pedidos_recebidos}</div>
        </div>
        <div class="stat-card green">
            <div class="label">Total Produtos</div>
            <div class="value">${kpis.produtos_vendidos}</div>
        </div>
        <div class="stat-card red">
            <div class="label">Comissões Totais</div>
            <div class="value">${formatCurrency(kpis.comissoes_acum.comissoes)}</div>
        </div>
        <div class="stat-card orange">
            <div class="label">Reembolsos</div>
            <div class="value">${formatCurrency(kpis.reembolsos_acum.total)}</div>
        </div>
    `;
}

function updateKPIs() {
    const container = document.getElementById('kpiCards');
    if (!kpis) {
        container.innerHTML = '<div class="empty-state">Carregue ficheiros de transações para ver KPIs</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="kpi-card blue">
            <div class="title">Pedidos Recebidos</div>
            <div class="value">${kpis.pedidos_recebidos}</div>
        </div>
        <div class="kpi-card green">
            <div class="title">Produtos Vendidos</div>
            <div class="value">${kpis.produtos_vendidos}</div>
        </div>
        <div class="kpi-card red">
            <div class="title">Total Comissões</div>
            <div class="value">${formatCurrency(kpis.comissoes_acum.comissoes)}</div>
        </div>
        <div class="kpi-card yellow">
            <div class="title">Reserva Presa</div>
            <div class="value">${formatCurrency(kpis.reserva_saldo)}</div>
        </div>
        <div class="kpi-card purple">
            <div class="title">Prazo Médio</div>
            <div class="value">${kpis.prazos.prazo_medio_dias.toFixed(1)}</div>
            <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">dias</div>
        </div>
        ${kpis.produto_mais_vendido_hist && kpis.produto_mais_vendido_hist.sku ? `
        <div class="kpi-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div class="title">🏆 Produto Mais Vendido (Histórico)</div>
            <div style="font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem; color: #f1f5f9; word-break: break-word;">${kpis.produto_mais_vendido_hist.sku}</div>
            <div style="font-size: 0.875rem; color: #cbd5e1; margin-top: 0.25rem;">${kpis.produto_mais_vendido_hist.categoria}</div>
            <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">${kpis.produto_mais_vendido_hist.quantidade} vendas</div>
            <div style="font-size: 0.875rem; color: #94a3b8;">${formatCurrency(kpis.produto_mais_vendido_hist.valor)}</div>
        </div>
        ` : ''}
        ${kpis.produto_mais_vendido_ult && kpis.produto_mais_vendido_ult.sku ? `
        <div class="kpi-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <div class="title">⭐ Produto Mais Vendido (Último Ciclo)</div>
            <div style="font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem; color: #f1f5f9; word-break: break-word;">${kpis.produto_mais_vendido_ult.sku}</div>
            <div style="font-size: 0.875rem; color: #cbd5e1; margin-top: 0.25rem;">${kpis.produto_mais_vendido_ult.categoria}</div>
            <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">${kpis.produto_mais_vendido_ult.quantidade} vendas</div>
            <div style="font-size: 0.875rem; color: #94a3b8;">${formatCurrency(kpis.produto_mais_vendido_ult.valor)}</div>
        </div>
        ` : ''}
    `;
    
    // Detalhes
    const detailsContainer = document.getElementById('kpiDetails');
    detailsContainer.innerHTML = `
        <div class="detail-card">
            <h3>Prazos (dias)</h3>
            <div class="detail-item">
                <span class="label">Média:</span>
                <span class="value" style="color: #60a5fa;">${kpis.prazos.prazo_medio_dias.toFixed(1)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Mínimo:</span>
                <span class="value" style="color: #4ade80;">${kpis.prazos.prazo_min_dias}</span>
            </div>
            <div class="detail-item">
                <span class="label">Máximo:</span>
                <span class="value" style="color: #f87171;">${kpis.prazos.prazo_max_dias}</span>
            </div>
        </div>
        <div class="detail-card">
            <h3>Comissões</h3>
            <div class="detail-item">
                <span class="label">Acumulado:</span>
                <span class="value" style="color: #60a5fa;">${formatCurrency(kpis.comissoes_acum.comissoes)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Último Ciclo:</span>
                <span class="value" style="color: #4ade80;">${formatCurrency(kpis.comissoes_ult.comissoes)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Imposto (Acum.):</span>
                <span class="value" style="color: #60a5fa;">${formatCurrency(kpis.comissoes_acum.imposto)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Imposto (Último):</span>
                <span class="value" style="color: #4ade80;">${formatCurrency(kpis.comissoes_ult.imposto)}</span>
            </div>
        </div>
        <div class="detail-card">
            <h3>Reembolsos</h3>
            <div class="detail-item">
                <span class="label">Acumulado:</span>
                <span class="value" style="color: #f87171;">${formatCurrency(kpis.reembolsos_acum.total)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Último Ciclo:</span>
                <span class="value" style="color: #fb923c;">${formatCurrency(kpis.reembolsos_ult.total)}</span>
            </div>
        </div>
        ${kpis.produto_mais_vendido_hist || kpis.produto_mais_vendido_ult ? `
        <div class="detail-card">
            <h3>🏆 Produtos Mais Vendidos</h3>
            ${kpis.produto_mais_vendido_hist ? `
            <div class="detail-item">
                <span class="label">Histórico:</span>
                <span class="value" style="color: #667eea; font-weight: 600;">${kpis.produto_mais_vendido_hist.sku}</span>
            </div>
            <div class="detail-item" style="padding-left: 1rem; font-size: 0.875rem;">
                <span class="label" style="color: #94a3b8;">Categoria:</span>
                <span class="value" style="color: #cbd5e1;">${kpis.produto_mais_vendido_hist.categoria}</span>
            </div>
            <div class="detail-item" style="padding-left: 1rem; font-size: 0.875rem;">
                <span class="label" style="color: #94a3b8;">Quantidade:</span>
                <span class="value" style="color: #60a5fa;">${kpis.produto_mais_vendido_hist.quantidade}</span>
            </div>
            <div class="detail-item" style="padding-left: 1rem; font-size: 0.875rem;">
                <span class="label" style="color: #94a3b8;">Valor Total:</span>
                <span class="value" style="color: #4ade80;">${formatCurrency(kpis.produto_mais_vendido_hist.valor)}</span>
            </div>
            ` : ''}
            ${kpis.produto_mais_vendido_ult ? `
            <div class="detail-item" style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 0.75rem;">
                <span class="label">Último Ciclo:</span>
                <span class="value" style="color: #f5576c; font-weight: 600;">${kpis.produto_mais_vendido_ult.sku}</span>
            </div>
            <div class="detail-item" style="padding-left: 1rem; font-size: 0.875rem;">
                <span class="label" style="color: #94a3b8;">Categoria:</span>
                <span class="value" style="color: #cbd5e1;">${kpis.produto_mais_vendido_ult.categoria}</span>
            </div>
            <div class="detail-item" style="padding-left: 1rem; font-size: 0.875rem;">
                <span class="label" style="color: #94a3b8;">Quantidade:</span>
                <span class="value" style="color: #60a5fa;">${kpis.produto_mais_vendido_ult.quantidade}</span>
            </div>
            <div class="detail-item" style="padding-left: 1rem; font-size: 0.875rem;">
                <span class="label" style="color: #94a3b8;">Valor Total:</span>
                <span class="value" style="color: #4ade80;">${formatCurrency(kpis.produto_mais_vendido_ult.valor)}</span>
            </div>
            ` : ''}
        </div>
        ` : ''}
    `;
}

function updateResumo() {
    const container = document.getElementById('cycleBreakdown');
    const title = document.getElementById('resumoTitle');
    
    if (!kpis || transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados disponíveis. Carregue ficheiros de transações primeiro.</div>';
        title.textContent = '📋 Resumo - Último Ciclo';
        return;
    }
    
    const ultimoCiclo = getUltimoCiclo();
    if (!ultimoCiclo) {
        container.innerHTML = '<div class="empty-state">Nenhum ciclo encontrado</div>';
        title.textContent = '📋 Resumo - Último Ciclo';
        return;
    }
    
    title.textContent = `📋 Resumo Detalhado - ${ultimoCiclo}`;
    
    const transacoesCiclo = transactions.filter(t => t['Ciclo Pagamento'] === ultimoCiclo);
    
    // Agrupar por tipo
    const breakdown = {};
    transacoesCiclo.forEach(t => {
        const tipo = t.Tipo || 'N/A';
        if (!breakdown[tipo]) {
            breakdown[tipo] = {
                tipo,
                credito: 0,
                debito: 0,
                real: 0,
                quantidade: 0
            };
        }
        breakdown[tipo].credito += t.Crédito || 0;
        breakdown[tipo].debito += t.Débito || 0;
        breakdown[tipo].real += t.real || 0;
        breakdown[tipo].quantidade += 1;
    });
    
    const breakdownArray = Object.values(breakdown).sort((a, b) => Math.abs(b.real) - Math.abs(a.real));
    const totalNet = breakdownArray.reduce((sum, item) => sum + item.real, 0);
    
    let html = `
        <div style="overflow-x: auto; margin-bottom: 1.5rem;">
            <table>
                <thead>
                    <tr>
                        <th>Tipo de Transação</th>
                        <th class="text-right">Quantidade</th>
                        <th class="text-right">Crédito</th>
                        <th class="text-right">Débito</th>
                        <th class="text-right">Real</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    breakdownArray.forEach(item => {
        html += `
            <tr>
                <td>${item.tipo}</td>
                <td class="text-right">${item.quantidade}</td>
                <td class="text-right" style="color: #4ade80;">${item.credito > 0 ? formatCurrency(item.credito) : '-'}</td>
                <td class="text-right" style="color: #f87171;">${item.debito > 0 ? formatCurrency(item.debito) : '-'}</td>
                <td class="text-right" style="color: ${item.real >= 0 ? '#60a5fa' : '#f87171'}; font-weight: bold;">${formatCurrency(item.real)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.125rem; font-weight: 600;">Total Net do Ciclo</span>
                <span style="font-size: 1.75rem; font-weight: bold; color: ${totalNet >= 0 ? '#4ade80' : '#f87171'};">${formatCurrency(totalNet)}</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function updateConciliacao() {
    const container = document.getElementById('reconciliationTable');
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados de conciliação. Carregue ficheiros de transações e TRF.</div>';
        return;
    }
    
    // Agrupar por ciclo
    const cycles = {};
    transactions.forEach(t => {
        const ciclo = t['Ciclo Pagamento'];
        if (!ciclo) return;
        
        if (!cycles[ciclo]) {
            cycles[ciclo] = {
                ciclo,
                net: 0,
                endDate: null
            };
        }
        cycles[ciclo].net += t.real || 0;
        
        if (t['Data do ciclo de faturamento']) {
            const dateStr = String(t['Data do ciclo de faturamento']).split(' - ')[0].trim();
            const date = new Date(dateStr.split('/').reverse().join('-'));
            if (!cycles[ciclo].endDate || date > cycles[ciclo].endDate) {
                cycles[ciclo].endDate = date;
            }
        }
    });
    
    // Calcular TRF para cada ciclo
    const cyclesArray = Object.values(cycles).map(cycle => {
        let trf07 = 0;
        if (cycle.endDate && trfData.length > 0) {
            const endDate = new Date(cycle.endDate);
            const windowEnd = new Date(endDate);
            windowEnd.setDate(windowEnd.getDate() + 7);
            
            trfData.forEach(trf => {
                if (trf.data) {
                    const trfDate = new Date(trf.data);
                    if (trfDate >= endDate && trfDate <= windowEnd) {
                        trf07 += parseFloat(trf.valor || 0);
                    }
                }
            });
        }
        
        return {
            ...cycle,
            trf_0_7: trf07,
            diff: trf07 - cycle.net
        };
    }).sort((a, b) => (b.endDate || 0) - (a.endDate || 0));
    
    if (cyclesArray.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados de ciclos</div>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Ciclo</th>
                    <th class="text-right">Data Fim</th>
                    <th class="text-right">Net</th>
                    <th class="text-right">TRF (0-7 dias)</th>
                    <th class="text-right">Diferença</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    cyclesArray.forEach(cycle => {
        const diffColor = Math.abs(cycle.diff) < 50 ? '#fbbf24' : 
                         cycle.diff === 0 ? '#4ade80' : '#f87171';
        const endDateStr = cycle.endDate ? cycle.endDate.toLocaleDateString('pt-PT') : '-';
        
        html += `
            <tr>
                <td>${cycle.ciclo}</td>
                <td class="text-right">${endDateStr}</td>
                <td class="text-right" style="color: #60a5fa; font-weight: 600;">${formatCurrency(cycle.net)}</td>
                <td class="text-right" style="color: #4ade80; font-weight: 600;">${formatCurrency(cycle.trf_0_7)}</td>
                <td class="text-right" style="color: ${diffColor}; font-weight: 600;">${formatCurrency(cycle.diff)}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function updateComissoes() {
    const container = document.getElementById('comissoes-tab');
    const canvas = document.getElementById('comissoesChart');
    
    if (!kpis || transactions.length === 0) {
        return;
    }
    
    // Agrupar comissões por ciclo
    const cycles = {};
    transactions.forEach(t => {
        if (t.Tipo && /taxa|comiss/i.test(t.Tipo)) {
            const ciclo = t['Ciclo Pagamento'];
            if (!ciclo) return;
            
            if (!cycles[ciclo]) {
                cycles[ciclo] = { ciclo, comissoes: 0, imposto: 0 };
            }
            cycles[ciclo].comissoes += t.Débito || 0;
        }
        if (t.Tipo && /imposto sobre.*(taxa|comiss)/i.test(t.Tipo)) {
            const ciclo = t['Ciclo Pagamento'];
            if (!ciclo) return;
            
            if (!cycles[ciclo]) {
                cycles[ciclo] = { ciclo, comissoes: 0, imposto: 0 };
            }
            cycles[ciclo].imposto += t.Débito || 0;
        }
    });
    
    const cyclesArray = Object.values(cycles).slice(0, 10); // Últimos 10 ciclos
    
    if (cyclesArray.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state">Sem dados de comissões por ciclo</div>';
        return;
    }
    
    // Destruir gráfico anterior se existir
    if (window.comissoesChart && typeof window.comissoesChart.destroy === 'function') {
        window.comissoesChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    window.comissoesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: cyclesArray.map(c => c.ciclo),
            datasets: [
                {
                    label: 'Comissões (€)',
                    data: cyclesArray.map(c => c.comissoes),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)'
                },
                {
                    label: 'Imposto (€)',
                    data: cyclesArray.map(c => c.imposto),
                    backgroundColor: 'rgba(251, 146, 60, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1' } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
        }
    });
    
    canvas.parentElement.style.height = '400px';
}

function updateReservas() {
    const container = document.getElementById('reservasInfo');
    
    if (!kpis) {
        container.innerHTML = '<div class="empty-state">Sem dados de reservas</div>';
        return;
    }
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
            <div style="background: #334155; padding: 1.5rem; border-radius: 0.5rem;">
                <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;">Saldo de Reserva (Estimado)</p>
                <p style="font-size: 2.5rem; font-weight: bold; color: #fbbf24;">${formatCurrency(kpis.reserva_saldo)}</p>
            </div>
            <div style="background: #334155; padding: 1.5rem; border-radius: 0.5rem;">
                <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;">Último Ciclo de Constituição</p>
                <p style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">${kpis.reserva_ult_ciclo || 'N/A'}</p>
            </div>
        </div>
    `;
}

function updatePrazos() {
    const container = document.getElementById('prazosInfo');
    
    if (!kpis) {
        container.innerHTML = '<div class="empty-state">Sem dados de prazos</div>';
        return;
    }
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
            <div style="background: #334155; padding: 1.5rem; border-radius: 0.5rem; text-align: center;">
                <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;">Prazo Médio</p>
                <p style="font-size: 2.5rem; font-weight: bold; color: #60a5fa;">${kpis.prazos.prazo_medio_dias.toFixed(1)}</p>
                <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">dias</p>
            </div>
            <div style="background: #334155; padding: 1.5rem; border-radius: 0.5rem; text-align: center;">
                <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;">Prazo Mínimo</p>
                <p style="font-size: 2.5rem; font-weight: bold; color: #4ade80;">${kpis.prazos.prazo_min_dias}</p>
                <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">dias</p>
            </div>
            <div style="background: #334155; padding: 1.5rem; border-radius: 0.5rem; text-align: center;">
                <p style="color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;">Prazo Máximo</p>
                <p style="font-size: 2.5rem; font-weight: bold; color: #f87171;">${kpis.prazos.prazo_max_dias}</p>
                <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">dias</p>
            </div>
        </div>
    `;
}

// Utilitários
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

function showSuccess(message) {
    if (uploadStatus) {
        uploadStatus.innerHTML = `<div class="status-success">✅ ${message}</div>`;
    } else {
        console.log('✅ Sucesso:', message);
    }
}

function showError(message) {
    if (uploadStatus) {
        uploadStatus.innerHTML = `<div class="status-error">❌ ${message}</div>`;
    } else {
        console.error('❌ Erro (uploadStatus não disponível):', message);
        alert(`Erro: ${message}`);
    }
}

// Análise de Faturas
function updateFaturas() {
    const container = document.getElementById('faturasInfo');
    
    if (!container) return; // Tab não existe ainda
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados de transações. Carregue ficheiros primeiro.</div>';
        return;
    }
    
    // Extrair comissões das faturas
    const comissoes = transactions.filter(t => {
        const tipo = (t.Tipo || '').toLowerCase();
        return tipo.includes('taxa') || tipo.includes('comiss') || tipo.includes('assinatura');
    });
    
    // Extrair reservas das faturas
    const reservas = transactions.filter(t => {
        const tipo = (t.Tipo || '').toLowerCase();
        const desc = (t.Descrição || '').toLowerCase();
        return (tipo.includes('fatura manual') || tipo.includes('crédito manual')) &&
               (desc.includes('reserv') || desc.includes('reten') || desc.includes('hold') || desc.includes('escrow'));
    });
    
    // Agrupar comissões por data de criação e data de receção
    const comissoesTimeline = comissoes.map(c => {
        const dataCriacao = c['Data Criação'] ? parseDate(c['Data Criação']) : null;
        const dataRececao = c['Data do ciclo de faturamento'] ? parseDate(c['Data do ciclo de faturamento']) : null;
        const prazo = dataCriacao && dataRececao ? Math.floor((dataRececao - dataCriacao) / (1000 * 60 * 60 * 24)) : null;
        
        return {
            tipo: c.Tipo,
            dataCriacao: dataCriacao ? formatDate(dataCriacao) : 'N/A',
            dataRececao: dataRececao ? formatDate(dataRececao) : 'N/A',
            prazo: prazo !== null ? prazo : 'N/A',
            valor: Math.abs(c.Débito || 0),
            ciclo: c['Ciclo Pagamento'] || 'N/A',
            descricao: c.Descrição || ''
        };
    }).sort((a, b) => {
        const dateA = parseDate(a.dataCriacao);
        const dateB = parseDate(b.dataCriacao);
        return (dateB || 0) - (dateA || 0);
    });
    
    // Agrupar reservas por data de criação e data de receção
    const reservasTimeline = reservas.map(r => {
        const dataCriacao = r['Data Criação'] ? parseDate(r['Data Criação']) : null;
        const dataRececao = r['Data do ciclo de faturamento'] ? parseDate(r['Data do ciclo de faturamento']) : null;
        const prazo = dataCriacao && dataRececao ? Math.floor((dataRececao - dataCriacao) / (1000 * 60 * 60 * 24)) : null;
        
        return {
            tipo: r.Tipo,
            dataCriacao: dataCriacao ? formatDate(dataCriacao) : 'N/A',
            dataRececao: dataRececao ? formatDate(dataRececao) : 'N/A',
            prazo: prazo !== null ? prazo : 'N/A',
            valor: Math.abs(r.real || 0),
            ciclo: r['Ciclo Pagamento'] || 'N/A',
            descricao: r.Descrição || ''
        };
    }).sort((a, b) => {
        const dateA = parseDate(a.dataCriacao);
        const dateB = parseDate(b.dataCriacao);
        return (dateB || 0) - (dateA || 0);
    });
    
    let html = `
        <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; color: #f1f5f9;">📊 Resumo</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Comissões</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #60a5fa;">${comissoes.length}</p>
                    <p style="color: #94a3b8; font-size: 0.875rem;">${formatCurrency(comissoes.reduce((sum, c) => sum + Math.abs(c.Débito || 0), 0))}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Reservas</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">${reservas.length}</p>
                    <p style="color: #94a3b8; font-size: 0.875rem;">${formatCurrency(reservas.reduce((sum, r) => sum + Math.abs(r.real || 0), 0))}</p>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; color: #f1f5f9;">💸 Comissões (Timeline)</h3>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Data Criação</th>
                            <th>Data Receção</th>
                            <th>Prazo (dias)</th>
                            <th class="text-right">Valor</th>
                            <th>Ciclo</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    comissoesTimeline.slice(0, 50).forEach(c => {
        html += `
            <tr>
                <td>${c.tipo}</td>
                <td>${c.dataCriacao}</td>
                <td>${c.dataRececao}</td>
                <td style="color: ${c.prazo !== 'N/A' && c.prazo > 30 ? '#f87171' : '#60a5fa'}">${c.prazo}</td>
                <td class="text-right" style="color: #f87171; font-weight: 600;">${formatCurrency(c.valor)}</td>
                <td>${c.ciclo}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            ${comissoesTimeline.length > 50 ? `<p style="color: #94a3b8; margin-top: 1rem;">Mostrando primeiras 50 de ${comissoesTimeline.length} comissões</p>` : ''}
        </div>
        
        <div>
            <h3 style="margin-bottom: 1rem; color: #f1f5f9;">🔒 Reservas (Timeline)</h3>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Data Criação</th>
                            <th>Data Receção</th>
                            <th>Prazo (dias)</th>
                            <th class="text-right">Valor</th>
                            <th>Ciclo</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    reservasTimeline.slice(0, 50).forEach(r => {
        html += `
            <tr>
                <td>${r.tipo}</td>
                <td>${r.dataCriacao}</td>
                <td>${r.dataRececao}</td>
                <td style="color: ${r.prazo !== 'N/A' && r.prazo > 30 ? '#f87171' : '#60a5fa'}">${r.prazo}</td>
                <td class="text-right" style="color: #a78bfa; font-weight: 600;">${formatCurrency(r.valor)}</td>
                <td>${r.ciclo}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            ${reservasTimeline.length > 50 ? `<p style="color: #94a3b8; margin-top: 1rem;">Mostrando primeiras 50 de ${reservasTimeline.length} reservas</p>` : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

// Extrato Bancário
function updateExtrato() {
    const container = document.getElementById('extratoInfo');
    
    if (!container) return; // Tab não existe ainda
    
    if (extratoBancario.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados de extrato bancário. Carregue um ficheiro de extrato primeiro.</div>';
        return;
    }
    
    // Calcular estatísticas
    const totalEntradas = extratoBancario.filter(e => e.valor > 0).reduce((sum, e) => sum + e.valor, 0);
    const totalSaidas = Math.abs(extratoBancario.filter(e => e.valor < 0).reduce((sum, e) => sum + e.valor, 0));
    const saldoFinal = extratoBancario.length > 0 ? extratoBancario[extratoBancario.length - 1].saldo : 0;
    
    // Ordenar por data
    const extratoOrdenado = [...extratoBancario].sort((a, b) => {
        const dateA = parseDate(a.data);
        const dateB = parseDate(b.data);
        return (dateB || 0) - (dateA || 0);
    });
    
    let html = `
        <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; color: #f1f5f9;">📊 Resumo do Extrato</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Entradas</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #4ade80;">${formatCurrency(totalEntradas)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Saídas</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #f87171;">${formatCurrency(totalSaidas)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Saldo Final</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: ${saldoFinal >= 0 ? '#4ade80' : '#f87171'}">${formatCurrency(saldoFinal)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Movimentos</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #60a5fa;">${extratoBancario.length}</p>
                </div>
            </div>
        </div>
        
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th class="text-right">Valor</th>
                        <th class="text-right">Saldo</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    extratoOrdenado.slice(0, 100).forEach(e => {
        html += `
            <tr>
                <td>${e.data}</td>
                <td>${e.descricao}</td>
                <td class="text-right" style="color: ${e.valor >= 0 ? '#4ade80' : '#f87171'}; font-weight: 600;">${formatCurrency(e.valor)}</td>
                <td class="text-right" style="color: ${e.saldo >= 0 ? '#60a5fa' : '#f87171'}">${formatCurrency(e.saldo)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        ${extratoOrdenado.length > 100 ? `<p style="color: #94a3b8; margin-top: 1rem;">Mostrando primeiras 100 de ${extratoOrdenado.length} movimentos</p>` : ''}
    `;
    
    container.innerHTML = html;
}

// Conciliação Detalhada
function updateConciliacaoDetalhada() {
    const container = document.getElementById('conciliacaoDetalhadaInfo');
    
    if (!container) return; // Tab não existe ainda
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados de transações. Carregue ficheiros primeiro.</div>';
        return;
    }
    
    // Calcular valor a receber do marketplace por ciclo
    const cycles = {};
    transactions.forEach(t => {
        const ciclo = t['Ciclo Pagamento'];
        if (!ciclo) return;
        
        if (!cycles[ciclo]) {
            cycles[ciclo] = {
                ciclo,
                net: 0,
                endDate: null,
                transacoes: []
            };
        }
        cycles[ciclo].net += t.real || 0;
        cycles[ciclo].transacoes.push(t);
        
        if (t['Data do ciclo de faturamento']) {
            const date = parseDate(t['Data do ciclo de faturamento']);
            if (date && (!cycles[ciclo].endDate || date > cycles[ciclo].endDate)) {
                cycles[ciclo].endDate = date;
            }
        }
    });
    
    // Calcular valor recebido no banco (TRF + Extrato)
    const cyclesArray = Object.values(cycles).map(cycle => {
        let trfValue = 0;
        let extratoValue = 0;
        
        if (cycle.endDate) {
            const endDate = new Date(cycle.endDate);
            const windowStart = new Date(endDate);
            windowStart.setDate(windowStart.getDate() - 2);
            const windowEnd = new Date(endDate);
            windowEnd.setDate(windowEnd.getDate() + 10);
            
            // TRF no período
            trfData.forEach(trf => {
                if (trf.data) {
                    const trfDate = parseDate(trf.data);
                    if (trfDate && trfDate >= windowStart && trfDate <= windowEnd) {
                        trfValue += parseFloat(trf.valor || 0);
                    }
                }
            });
            
            // Extrato no período (apenas entradas)
            extratoBancario.forEach(ext => {
                if (ext.data && ext.valor > 0) {
                    const extDate = parseDate(ext.data);
                    if (extDate && extDate >= windowStart && extDate <= windowEnd) {
                        // Tentar identificar transferências do marketplace
                        const desc = (ext.descricao || '').toLowerCase();
                        if (desc.includes('marketplace') || desc.includes('amazon') || desc.includes('vendas')) {
                            extratoValue += ext.valor;
                        }
                    }
                }
            });
        }
        
        const totalRecebido = trfValue + extratoValue;
        const diferenca = totalRecebido - cycle.net;
        
        return {
            ...cycle,
            trfValue,
            extratoValue,
            totalRecebido,
            diferenca,
            endDateStr: cycle.endDate ? formatDate(cycle.endDate) : '-'
        };
    }).sort((a, b) => (b.endDate || 0) - (a.endDate || 0));
    
    if (cyclesArray.length === 0) {
        container.innerHTML = '<div class="empty-state">Sem dados de ciclos</div>';
        return;
    }
    
    // Calcular totais
    const totalMarketplace = cyclesArray.reduce((sum, c) => sum + c.net, 0);
    const totalTRF = cyclesArray.reduce((sum, c) => sum + c.trfValue, 0);
    const totalExtrato = cyclesArray.reduce((sum, c) => sum + c.extratoValue, 0);
    const totalRecebido = totalTRF + totalExtrato;
    const totalDiferenca = totalRecebido - totalMarketplace;
    
    let html = `
        <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; color: #f1f5f9;">📊 Resumo Geral</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total a Receber (Marketplace)</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #60a5fa;">${formatCurrency(totalMarketplace)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Recebido (TRF)</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #4ade80;">${formatCurrency(totalTRF)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Recebido (Extrato)</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #4ade80;">${formatCurrency(totalExtrato)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Total Recebido</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: #4ade80;">${formatCurrency(totalRecebido)}</p>
                </div>
                <div style="background: #334155; padding: 1rem; border-radius: 0.5rem;">
                    <p style="color: #94a3b8; font-size: 0.875rem;">Diferença</p>
                    <p style="font-size: 1.5rem; font-weight: bold; color: ${totalDiferenca >= 0 ? '#4ade80' : '#f87171'}">${formatCurrency(totalDiferenca)}</p>
                </div>
            </div>
        </div>
        
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Ciclo</th>
                        <th class="text-right">Data Fim</th>
                        <th class="text-right">A Receber (Marketplace)</th>
                        <th class="text-right">Recebido (TRF)</th>
                        <th class="text-right">Recebido (Extrato)</th>
                        <th class="text-right">Total Recebido</th>
                        <th class="text-right">Diferença</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    cyclesArray.forEach(cycle => {
        const diffColor = Math.abs(cycle.diferenca) < 50 ? '#fbbf24' : 
                         cycle.diferenca === 0 ? '#4ade80' : '#f87171';
        
        html += `
            <tr>
                <td>${cycle.ciclo}</td>
                <td class="text-right">${cycle.endDateStr}</td>
                <td class="text-right" style="color: #60a5fa; font-weight: 600;">${formatCurrency(cycle.net)}</td>
                <td class="text-right" style="color: #4ade80;">${formatCurrency(cycle.trfValue)}</td>
                <td class="text-right" style="color: #4ade80;">${formatCurrency(cycle.extratoValue)}</td>
                <td class="text-right" style="color: #4ade80; font-weight: 600;">${formatCurrency(cycle.totalRecebido)}</td>
                <td class="text-right" style="color: ${diffColor}; font-weight: 600;">${formatCurrency(cycle.diferenca)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// Funções auxiliares para datas
function parseDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return null;
    // Tentar diferentes formatos
    const parts = String(dateStr).split(/[/-]/);
    if (parts.length === 3) {
        // DD/MM/YYYY ou YYYY-MM-DD
        if (parts[0].length === 4) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    return new Date(dateStr);
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('pt-PT');
}

