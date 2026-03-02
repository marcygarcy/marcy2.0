# 📚 Documentação Técnica Completa - Sistema de Pagamentos de Marketplaces

**Versão**: 1.1  
**Data**: Fevereiro 2026  
**Status**: ✅ Ativo em Produção

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Instalação](#instalação)
5. [Configuração](#configuração)
6. [Estrutura do Projeto](#estrutura-do-projeto)
7. [Database](#database)
8. [API Endpoints](#api-endpoints)
9. [Fluxo de Dados](#fluxo-de-dados)
10. [Como Usar](#como-usar)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Sistema completo de **análise e gestão de recebimentos de marketplaces**, com suporte multi-tenant, cálculo automático de KPIs, reconciliação de dados e análises em tempo real.

### 🎯 Objetivos Principais

- ✅ Gerir múltiplas empresas e marketplaces
- ✅ Processar transações, transferências e ordens
- ✅ Calcular KPIs automáticos em tempo real
- ✅ Reconciliar dados (Net vs Transferências)
- ✅ Gerar relatórios e análises
- ✅ Controlar comissões e reembolsos
- ✅ Gerir reservas bancárias

### 📊 Funcionalidades Principais

| Feature | Descrição | Status |
|---------|-----------|--------|
| **Multi-tenant** | Suporta múltiplas empresas isoladas | ✅ Ativo |
| **Upload de Dados** | Transações, transferências, invoices, orders | ✅ Ativo |
| **KPIs Automáticos** | Prazos, comissões, reembolsos, reserva | ✅ Ativo |
| **Listagens** | Transações, pedidos, pendentes | ✅ Ativo |
| **Gestão Bancária** | Movimentos, transferências | ✅ Ativo |
| **Conciliação** | Net vs TRF, análise de diferenças | ✅ Ativo |
| **Análises** | Gráficos em tempo real | ✅ Ativo |
| **Autenticação** | Multi-tenant por cookies | ✅ Ativo |

---

## 🏗️ Arquitetura

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                 │
│  - React Components                                     │
│  - Tailwind CSS                                         │
│  - Recharts (Gráficos)                                  │
│  - Formulários com React Hook Form                      │
└─────────────────────────────────────────────────────────┘
                           ↓
                    (HTTP REST API)
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│  - API REST com endpoints documentados                  │
│  - Middleware CORS e autenticação                       │
│  - Processamento de dados                               │
│  - Cálculo de KPIs                                      │
└─────────────────────────────────────────────────────────┘
                           ↓
                    (Python/SQL)
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  DATABASE (DuckDB)                       │
│  - Tabelas: transactions, transfers, invoices, etc.     │
│  - Índices e constraints                                │
│  - Queries otimizadas                                   │
└─────────────────────────────────────────────────────────┘
```

### Padrão de Arquitetura

```
MVC (Model-View-Controller)
├── Models: Schemas, DB models
├── Views: Frontend React components
└── Controllers: API routers
```

### Camadas da Aplicação

```
┌─────────────────────────────────────────────┐
│           Presentation Layer                │
│    (Components React, UI/UX)                │
├─────────────────────────────────────────────┤
│           API Layer                         │
│    (FastAPI Routers, Endpoints)             │
├─────────────────────────────────────────────┤
│           Business Logic Layer              │
│    (Services: KPIs, Upload, etc.)           │
├─────────────────────────────────────────────┤
│           Data Access Layer                 │
│    (Database queries, ETL)                  │
├─────────────────────────────────────────────┤
│           Database Layer                    │
│    (DuckDB, Tables, Indexes)                │
└─────────────────────────────────────────────┘
```

---

## 💻 Stack Tecnológico

### Backend
- **Framework**: FastAPI 0.104.1+
- **Server**: Uvicorn
- **Database**: DuckDB 0.9.2+
- **Data Processing**: Pandas 2.1.0+
- **Validation**: Pydantic 2.5.0+
- **Configuration**: PyYAML 6.0.1+
- **Python**: 3.9+

### Frontend
- **Framework**: Next.js 14.0.3
- **UI Library**: React 18.2.0+
- **Styling**: Tailwind CSS 3.3.6
- **HTTP Client**: Axios 1.6.2+
- **Charts**: Recharts 2.10.3
- **Icons**: Lucide React 0.294.0
- **Forms**: React Hook Form 7.49.2
- **Validation**: Zod 3.22.4

### DevOps
- **Node.js**: LTS
- **Package Manager**: npm (frontend), pip (backend)
- **Version Control**: Git
- **Deployment**: Scripts batch (.bat)

---

## 🚀 Instalação

### Pré-requisitos

- Python 3.9+
- Node.js LTS
- Git
- Espaço em disco: ~500MB

### Instalação Completa

#### 1. Clonar ou Fazer Download

```bash
# Ir para o diretório
cd "c:\Users\admin\Documents\Marisa\Big\new - Copy"
```

#### 2. Instalar Backend

```bash
cd backend
pip install -r requirements.txt
```

#### 3. Instalar Frontend

```bash
cd frontend
npm install
```

#### 4. Iniciar Aplicação

**Opção 1: Script automático (Windows)**
```bash
start_completo.bat
```

**Opção 2: Manual (recomendado para desenvolvimento)**

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
