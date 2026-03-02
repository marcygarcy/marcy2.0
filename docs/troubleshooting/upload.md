# 🔍 Troubleshooting: Upload

Problemas específicos relacionados com upload de ficheiros.

## Verificar Consola do Browser

Abra a consola (F12 → Console) e verifique:

### Upload Inicial
- ✅ "🚀 Inicializando aplicação..."
- ✅ "✅ Elementos DOM encontrados"
- ✅ "✅ Upload inicializado"

### Seleção de Ficheiro
- ✅ "📁 Drop zone clicado"
- ✅ "📁 Ficheiro selecionado: X ficheiros"
- ✅ "📄 Ficheiro selecionado: [nome] Tamanho: [bytes]"

### Processamento
- ✅ "🔄 Botão processar clicado"
- ✅ "🔄 Iniciando processamento de ficheiro..."
- ✅ "📖 Lendo como Excel..." ou "📖 Lendo como CSV..."

## Erros Comuns

### "XLSX não está carregado"
**Solução**:
- Recarregue a página (F5) e aguarde
- Verifique a conexão à internet (bibliotecas via CDN)

### "Elementos DOM não encontrados"
**Solução**:
- Recarregue a página (F5)
- Verifique se está na URL correta (localhost:3000)

### "Erro ao ler ficheiro"
**Solução**:
- Verifique se o ficheiro não está corrompido
- Tente abrir no Excel primeiro
- Converta para outro formato

### "Encoding incorreto"
**Solução**:
- O sistema tenta corrigir automaticamente
- Se persistir, converta para UTF-8
- Use Excel para salvar como XLSX

## Verificar Ficheiro

### Formato
- ✅ Deve ser XLSX ou CSV
- ✅ Não deve estar corrompido
- ✅ Deve ter dados válidos

### Colunas
- ✅ Verifique se tem as colunas necessárias
- ✅ Verifique nomes das colunas (variações aceites)
- ✅ Verifique se não está vazio

### Tamanho
- ⚠️ Ficheiros muito grandes podem demorar
- ⚠️ Considere dividir em partes menores
- ⚠️ Aguarde, o processo continua

## Testar Upload

1. Abra a consola (F12)
2. Clique na área de upload
3. Selecione um ficheiro
4. Veja os logs na consola
5. Copie e envie os erros que aparecerem

## Verificar URL

- ✅ Deve ser: **http://localhost:3000**
- ❌ **NÃO** deve ser: localhost:3001 ou localhost:8000

## Referências

- [Estrutura de Ficheiros](../setup/file-structure.md)
- [Upload de Ficheiros](../usage/file-upload.md)

