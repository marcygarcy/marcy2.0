# 🔍 Debug: Problemas com Upload

## Se não consegue carregar o ficheiro:

### 1. Verificar a Consola do Browser
Abra a consola (F12 → Console) e verifique:
- ✅ Deve aparecer: "🚀 Inicializando aplicação..."
- ✅ Deve aparecer: "✅ Elementos DOM encontrados"
- ✅ Deve aparecer: "✅ Upload inicializado"

### 2. Quando clicar no botão de upload:
- Deve aparecer: "📁 Drop zone clicado"
- Deve aparecer: "📁 Ficheiro selecionado: X ficheiros"
- Deve aparecer: "📄 Ficheiro selecionado: [nome] Tamanho: [bytes]"

### 3. Quando clicar em "Processar Ficheiro":
- Deve aparecer: "🔄 Botão processar clicado"
- Deve aparecer: "🔄 Iniciando processamento de ficheiro..."
- Deve aparecer: "📄 Processando: [nome] Tamanho: [bytes]"
- Deve aparecer: "📖 Lendo como Excel..." ou "📖 Lendo como CSV..."

### 4. Se aparecerem erros:
- **"XLSX não está carregado"** → Recarregue a página (F5) e aguarde
- **"Elementos DOM não encontrados"** → Recarregue a página (F5)
- **"Erro ao ler ficheiro"** → Verifique se o ficheiro não está corrompido

### 5. Verificar se está na página correta:
- URL deve ser: **http://localhost:3000**
- **NÃO** deve ser: localhost:3001 ou localhost:8000

### 6. Testar:
1. Abra a consola (F12)
2. Clique na área de upload
3. Selecione um ficheiro
4. Veja os logs na consola
5. Copie e envie os erros que aparecerem

