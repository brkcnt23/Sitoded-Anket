# 🎯 Sitoded Anket - Modern Event Management System

## 📋 Última Atualização

**Versão:** 2.0.0  
**Data:** 2024  
**Alterações Principais:** Refactoring completo da UI/UX, novo sistema de agendamento, gestão de pontos, e painel de yoklama (presença).

---

## ✨ Principais Mudanças

### 1. **Database Schema**
- ✅ Adicionado `start_time` e `end_time` aos eventos
- ✅ Nova tabela `event_attendance` para registro de presença
- ✅ Nova tabela `point_transactions` para auditoria de pontos
- ✅ Colunas adicionais em `event_registrations` para controle de fila

### 2. **Backend (server.js)**
- ✅ API RESTful melhorada com endpoints modernos
- ✅ Detecção automática de conflitos de horários
- ✅ Sistema de gerenciamento de pontos com auditoria
- ✅ Endpoints de marcação de presença (yoklama)
- ✅ Dashboard API com dados completos de eventos

### 3. **Frontend - UI/UX Redesign**
- ✅ **Dashboard:** Interface moderna com grid de cards de eventos
- ✅ **Weekly Calendar Widget:** Visualização de semana no painel lateral direito
- ✅ **Event Cards:** Design bonito com informações detalhadas e status visual
- ✅ **Conflict Detection:** Alertas em tempo real de conflitos de horários
- ✅ **Event Creation Form:** Formulário intuitivo com validação de horários
- ✅ **Admin Panel:** Painel melhorado com gestão de pontos
- ✅ **Attendance Marking:** Interface dedicada para marcar presença

### 4. **Recursos Novos**
- 🆕 Detecção de conflitos de horários (não permite registrar em eventos com horários sobrepostos)
- 🆕 Sistema de fila inteligente (se alguém cancelar e se re-registrar, vai para o final da fila)
- 🆕 Marcação de presença com pontuação automática
- 🆕 Histórico de transações de pontos
- 🆕 Gestão de pontos pelo admin (adicionar/remover com auditoria)

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (v14+)
- PostgreSQL rodando em Docker ou localmente
- npm ou yarn

### Passo 1: Preparar o Banco de Dados

#### Se você NUNCA rodou o projeto:
```bash
# Acesse seu PostgreSQL
psql -U postgres

# Execute o arquivo database.sql original
\i C:\Users\brkcn\Desktop\Sitoded-Anket\database.sql

# Depois execute o arquivo de seed
node seed.js
```

#### Se você JÁ TEM o banco de dados:
```bash
# Simplesmente execute a migração
psql -U burakcan_sitoded -d burakcan_sitoded_db < migration.sql
```

**Credenciais (no seu .env):**
```
DB_HOST=localhost  (ou host.docker.internal se usar Docker)
DB_PORT=5432
DB_NAME=burakcan_sitoded_db
DB_USER=burakcan_sitoded
DB_PASSWORD=Sitoded25Ikbal
```

### Passo 2: Instalar Dependências
```bash
cd C:\Users\brkcn\Desktop\Sitoded-Anket
npm install
```

### Passo 3: Rodar o Servidor
```bash
npm run dev   # Usa nodemon para auto-reload
# ou
npm start     # Rodagem normal
```

O servidor estará disponível em: **http://localhost:3075**

### Passo 4: Login de Teste

**Começar em:**
```
http://localhost:3075/login
```

**Credenciais:**
| Usuário | Senha | Papel |
|---------|-------|-------|
| nuriye_memisoglu | Sitoded2026! | ADMIN (Başkan) |
| kadir_ergun | Sitoded2026! | SENIOR (Koordinatör) |
| ayberk_oksuz | Sitoded2026! | SENIOR |
| bugrahann_enes | Sitoded2026! | SENIOR |
| Can_volunteer | Sitoded2026! | VOLUNTEER |

---

## 📁 Estrutura de Arquivos Modificados

```
Sitoded-Anket/
├── database.sql              ✏️ ATUALIZADO - Schema melhorado
├── migration.sql             🆕 NOVO - Migration script
├── seed.js                   ✏️ ATUALIZADO - Com start_time/end_time
├── server.js                 ✏️ COMPLETO REWRITE - Novos endpoints
├── package.json              ✔️ Sem mudanças
│
└── views/
    ├── dashboard.ejs         🆕 NOVO - Redesign completo
    ├── login.ejs             ✔️ Mantido
    ├── layout.ejs            ✔️ Mantido
    │
    ├── events/
    │   ├── create.ejs        ✏️ ATUALIZADO - Com horários
    │   ├── registrations.ejs  🆕 NOVO - Yoklama interface
    │   └── ...
    │
    ├── admin/
    │   ├── panel.ejs         ✏️ ATUALIZADO - Com gestão de pontos
    │   └── ...
    │
    └── errors/
        ├── 404.ejs           ✔️ Mantido
        ├── 500.ejs           ✔️ Mantido
        └── ...
```

---

## 🔄 Fluxo da Aplicação Atualizado

### 1. **Criação de Evento**
```
SENIOR/COORDINATOR/ADMIN 
  → /events/create (formulário)
  → Especifica: início, fim, data, capacidade
  → Sistema calcula deadline (domingo 23:59)
  → ✓ Evento criado
```

### 2. **Registro em Evento**
```
VOLUNTEER/JUNIOR/SENIOR/COORDINATOR/ADMIN
  → Vê evento no dashboard
  → Clica "Katıl" (Participar)
  → Sistema verifica:
    ├─ Deadline passou? → ❌ Erro
    ├─ Já registrado? → ❌ Erro
    └─ Conflito de horários? → ⚠️ Aviso
  → ✓ Se OK → Registrado (CONFIRMED ou QUEUED)
```

### 3. **Cancelamento de Participação**
```
VOLUNTEER registrado
  → Antes de domingo 23:59 → ✓ Cancela (sem penalidade)
  → Depois de domingo 23:59 → ✓ Cancela (custa -1 ponto)
  → Se re-registrar:
    ├─ Antes de deadline → Vai para FINAL da fila
    └─ Depois de deadline → ❌ Não pode registrar
```

### 4. **Marcação de Presença (Yoklama)**
```
Após evento passar:

SENIOR/COORDINATOR/ADMIN
  → Clica em /event/:id/registrations
  → Marca quem compareceu (checkbox)
  → Clica "Kaydet"
  → Sistema:
    ├─ Compareceu → +1 ponto
    └─ Não compareceu → -1 ponto
  → ✓ Presença registrada com auditoria
```

### 5. **Gestão de Pontos (Admin)**
```
ADMIN
  → /admin (painel)
  → Seção "Puan Yönetimi"
  → Seleciona usuário
  → Adiciona/remove pontos com motivo
  → Sistema registra quem fez a mudança
  → ✓ Auditado em point_transactions
```

---

## 📊 Modelos de Dados

### Events (Atualizado)
```sql
- id (PK)
- title VARCHAR(200)
- description TEXT
- location VARCHAR(200)
- event_date DATE         🆕 Mudou de TIMESTAMP para DATE
- start_time TIME         🆕 NOVO
- end_time TIME           🆕 NOVO
- capacity INTEGER
- leader_id INTEGER (FK)
- team_id INTEGER (FK)
- status VARCHAR(20)      -- ACTIVE, CANCELLED, COMPLETED
- registration_deadline TIMESTAMP
- created_at, updated_at
```

### Event Registrations (Atualizado)
```sql
- id (PK)
- event_id INTEGER (FK)
- user_id INTEGER (FK)
- status VARCHAR(20)                 -- CONFIRMED, REGISTERED, CANCELLED
- registered_at TIMESTAMP
- cancelled_at TIMESTAMP
- requeued_at TIMESTAMP             🆕 NOVO - Para controle de fila
- cancelled_after_deadline BOOLEAN   🆕 NOVO - Para penalidade
- queue_position INTEGER
- created_at
```

### Event Attendance (NOVO)
```sql
- id (PK)
- event_id INTEGER (FK)
- user_id INTEGER (FK)
- marked_by INTEGER (FK)             -- Quem marcou
- attended BOOLEAN
- marked_at TIMESTAMP
- UNIQUE (event_id, user_id)
```

### Point Transactions (NOVO)
```sql
- id (PK)
- user_id INTEGER (FK)
- event_id INTEGER (FK) - NULL se manual
- points_change INTEGER              -- Pode ser negativo
- reason VARCHAR(50)                 -- ATTENDANCE, NO_SHOW, MANUAL_EDIT, LATE_CANCEL
- edited_by INTEGER (FK)             -- NULL se system
- created_at TIMESTAMP
```

---

## 🎨 Design & UX

### Cores (CSS Variables)
```css
--primary: #1F2937          /* Dark Gray */
--success: #10B981          /* Green */
--warning: #F59E0B          /* Amber */
--danger: #EF4444           /* Red */
--info: #3B82F6             /* Blue */
--bg: #F9FAFB               /* Light Gray BG */
--bg-white: #FFFFFF         /* White */
```

### Tipografia
- **Fonte:** System Stack (SF Pro, Segoe UI, Roboto)
- **Heading:** 700 weight
- **Body:** 400-600 weight
- **Tamanho base:** 14px (mobile-first)

---

## 🔍 Troubleshooting

### "PostgreSQL connection error"
```
Solução:
1. Verifique se PostgreSQL está rodando
2. Confirme credenciais no .env
3. Se Docker: verifique se o container está rodando
```

### "Table or column does not exist"
```
Solução:
1. Execute migration.sql
2. Reseed o database se necessário: node seed.js
3. Reinicie o servidor
```

### "Horários não aparecem no formulário"
```
Solução:
1. Limpe cache do navegador (Ctrl+Shift+R)
2. Certifique-se de que server.js foi reiniciado
```

---

## 📝 Próximas Etapas (Após Local Testing)

Após confirmar que tudo funciona localmente:

1. **Deploy em Produção:**
   - Execute migration.sql no servidor
   - Atualize server.js no servidor
   - Atualize arquivos .ejs em /views
   - Reinicie serviço Node.js

2. **Testes Recomendados:**
   - [x] Criar evento com horários
   - [x] Registrar e verificar conflitos
   - [x] Cancelar com penalidade
   - [x] Re-registrar (fila)
   - [x] Marcar presença
   - [x] Verificar pontos

---

## 📞 Suporte

Para perguntas ou problemas:
1. Verifique este README
2. Consulte os comentários no código
3. Verifique console do navegador (F12)
4. Verifique logs do servidor (terminal)

---

**Status:** ✅ Pronto para uso local  
**Testado com:** Node.js v16+, PostgreSQL 12+, Chrome/Firefox  
**Última atualização:** 2024
