# 🚀 QUICK START GUIDE

## ⚡ Começar em 5 minutos

### Pré-requisitos: ✅
- PostgreSQL rodando (Docker ou local)
- Node.js instalado
- npm/yarn

---

## PASSO 1: Preparar Banco de Dados (2 min)

### Option A: Banco NOVO
```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar usuario e banco
CREATE USER burakcan_sitoded WITH PASSWORD 'Sitoded25Ikbal';
CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;

# Sair (\q) e executar script
psql -U burakcan_sitoded -d burakcan_sitoded_db < database.sql

# Seedar dados de teste
node seed.js
```

### Option B: Banco EXISTENTE
```bash
# Apenas executar migration
psql -U burakcan_sitoded -d burakcan_sitoded_db < migration.sql
```

---

## PASSO 2: Instalar Dependências (1 min)

```bash
cd C:\Users\brkcn\Desktop\Sitoded-Anket
npm install
```

---

## PASSO 3: Rodar Servidor (1 min)

```bash
npm run dev
```

Output esperado:
```
✅ Server running on port 3075
🌐 http://localhost:3075
```

---

## PASSO 4: Acessar & Testar (1 min)

**URL:** http://localhost:3075/login

**Login de teste:**
| User | Senha |
|------|-------|
| Can_volunteer | Sitoded2026! |
| ayberk_oksuz | Sitoded2026! |
| nuriye_memisoglu | Sitoded2026! |

---

## ✅ Checklist Funcional

- [ ] Login funciona
- [ ] Dashboard carrega com eventos
- [ ] Weekly calendar aparece no sidebar
- [ ] Posso clicar "Katıl" em um evento
- [ ] Conflict warning aparece se houver conflito
- [ ] Posso clicar "Katılma" para cancelar
- [ ] Admin pode ir em /admin (se ADMIN)
- [ ] Pode criar evento em /events/create (se SENIOR)

---

## 🐛 Se algo não funcionar

### Erro: "Database connection error"
```bash
# Verificar se PostgreSQL está rodando
# Se Docker: docker ps
# Verificar credenciais no .env
```

### Erro: "Table does not exist"
```bash
# Rodar migration.sql novamente
psql -U burakcan_sitosed -d burakcan_sitoded_db < migration.sql
```

### Erro: "Modules not found"
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### CSS não carrega / Layout quebrado
```bash
# Limpar cache do navegador
# Ctrl+Shift+R (hard refresh)
# Ou abrir em private/incognito window
```

---

## 📖 Documentação Completa

- **DEPLOYMENT.md** - Setup detalhado & troubleshooting
- **IMPLEMENTATION_SUMMARY.md** - Tudo que foi implementado
- **database.sql** - Schema do banco
- **migration.sql** - Mudanças adicionadas

---

## 🎯 Próximos Passos

1. ✅ Teste local (você está aqui)
2. 📊 Execute testes manuais
3. 🚀 Deploy em staging
4. 🔍 Validar em produção
5. 📈 Monitorar & otimizar

---

**Pronto? Boa sorte! 🎉**

Qualquer dúvida, consulte os arquivos de documentação.
