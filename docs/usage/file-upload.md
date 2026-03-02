# 📤 Upload de Ficheiros

Guia detalhado sobre como fazer upload de ficheiros no sistema.

## Tipos de Upload

### 1. Histórico de Transações

**Localização**: Tab "📥 Upload" → "Histórico de Transações (XLSX/CSV)"

**Formato**: XLSX ou CSV

**Ficheiro esperado**: `historico_trasacoes.xlsx` ou similar

**Processo**:
1. Selecione o tipo de upload
2. Arraste o ficheiro ou clique para selecionar
3. Aguarde o processamento
4. Verifique a mensagem de sucesso

**Colunas necessárias**: Ver [Estrutura de Ficheiros](../setup/file-structure.md)

### 2. Transferências Bancárias (TRF)

**Localização**: Tab "📥 Upload" → "Transferências Bancárias (TRF)"

**Formato**: XLSX ou CSV

**Colunas esperadas**:
- `data` (Data)
- `valor` (Valor)
- `referencia` (Referência)
- `descricao` (Descrição)

### 3. Listagem de Orders

**Localização**: Tab "📥 Upload" → "Listagem de Orders (XLSX/CSV)"

**Formato**: XLSX ou CSV

**Colunas esperadas**:
- `numero_pedido` / `Nº Pedido`
- `data_criacao` / `Data Criação`
- `ciclo_pagamento` / `Ciclo`
- `valor_total` / `Valor Total`
- E mais...

## Processo de Upload

### Passo a Passo

1. **Navegar para Upload**
   - Clique na tab "📥 Upload"

2. **Selecionar Tipo**
   - Escolha o tipo de ficheiro no dropdown

3. **Selecionar Ficheiro**
   - Arraste e solte OU
   - Clique na área de upload

4. **Aguardar Processamento**
   - O sistema processa automaticamente
   - Aguarde a mensagem de sucesso/erro

5. **Verificar Resultados**
   - Verifique os KPIs atualizados
   - Confirme nas listagens

## Problemas Comuns

### Erro: "Ficheiro inválido"
- Verifique o formato (XLSX ou CSV)
- Verifique se as colunas necessárias existem

### Erro: "Nenhum pedido válido encontrado"
- O ficheiro foi carregado mas não há dados válidos
- Verifique o mapeamento de colunas
- O sistema pode criar IDs temporários

### Erro: "Encoding incorreto"
- Tente converter o ficheiro para UTF-8
- Use Excel para salvar como XLSX

### Upload muito lento
- Ficheiros grandes podem demorar
- Verifique o tamanho do ficheiro
- Considere dividir o ficheiro

## Limpar Dados

Para limpar dados existentes antes de novo upload:
- O sistema pode perguntar se deseja limpar
- Confirme apenas se tiver certeza

## Mapeamento Automático

O sistema reconhece variações de nomes de colunas:
- `Data Criação` / `Data Criacao` / `data_criacao`
- `Nº Pedido` / `numero_pedido` / `Order`
- `Ciclo Pagamento` / `ciclo_pagamento` / `Cycle`

## Referências

- [Estrutura de Ficheiros](../setup/file-structure.md)
- [Troubleshooting Upload](../troubleshooting/upload.md)

