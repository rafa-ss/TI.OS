# 🛠️ Sistema de Ordens de Serviço — SEMED Abaetetuba (T.I.)

Aplicação web completa para gestão de chamados, manutenção de equipamentos e produtividade da equipe de Tecnologia da Informação da Secretaria Municipal de Educação de Abaetetuba.

## 🚀 Stack

| Camada    | Tecnologias |
|-----------|------------|
| Frontend  | React 18 + Vite, TailwindCSS, React Router, Axios, Context API, Recharts, Lucide, React Hot Toast |
| Backend   | Node.js, Express (MVC), JWT + RBAC, Zod, Helmet, Rate Limit, Compression, Multer |
| Banco     | MongoDB (Mongoose), com índices e relacionamentos |
| Storage   | Supabase Storage (com fallback local) |
| Relatórios| ExcelJS (XLSX), PDFKit (PDF) |
| Importação| XLSX/CSV do Censo Escolar |

## 📁 Estrutura

```
os-abaetetuba/
├── backend/
│   ├── src/
│   │   ├── config/          # env, database, supabase
│   │   ├── controllers/     # HTTP layer
│   │   ├── middlewares/     # auth, validate, upload, errors
│   │   ├── models/          # mongoose
│   │   ├── routes/          # endpoints REST
│   │   ├── services/        # auth, storage, import, report, notification
│   │   ├── validations/     # schemas zod
│   │   └── utils/           # logger, AppError, paginate, seed
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/      # UI reaproveitáveis
    │   ├── context/         # Auth + Theme
    │   ├── layouts/         # Sidebar, Navbar, AppLayout
    │   ├── pages/           # Login, Dashboard, Orders, Equipment, Schools, Users, Reports, ImportCenso
    │   ├── routes/          # ProtectedRoute
    │   ├── services/        # api (axios)
    │   └── utils/           # formatadores e labels
    ├── .env.example
    ├── vercel.json
    ├── netlify.toml
    └── package.json
```

## ✅ Pré-requisitos

- **Node.js 18+** (recomendado 20 LTS)
- **npm 9+**
- **MongoDB** — local ou MongoDB Atlas
- (Opcional) **Conta Supabase** para storage de anexos

> Se você não tiver MongoDB local, crie um cluster grátis em https://www.mongodb.com/atlas/database e cole a connection string em `MONGODB_URI`.

---

## ▶️ Como rodar no VS Code (passo a passo)

### 1. Abrir o projeto

```bash
code os-abaetetuba
```

No VS Code, abra **dois terminais integrados** (Ctrl+Shift+`).

### 2. Backend

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm run dev
```

✔ Backend disponível em **http://localhost:5000/api/v1**
✔ Um usuário admin é criado automaticamente:

```
Email:  admin@semed.abaetetuba.pa.gov.br
Senha:  Admin@123
```

### 3. Frontend (em outro terminal)

```bash
cd frontend
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm run dev
```

✔ Frontend disponível em **http://localhost:5173**

### 4. Login

Acesse http://localhost:5173 e use as credenciais acima.

---

## 🔐 Perfis e permissões (RBAC)

| Funcionalidade        | Admin | Técnico | Atendente |
|-----------------------|:-----:|:-------:|:---------:|
| Login                 | ✅    | ✅      | ✅        |
| Dashboard             | ✅    | ✅      | ✅        |
| Criar/editar O.S.     | ✅    | ✅      | ✅        |
| Excluir O.S.          | ✅    | ❌      | ❌        |
| Equipamentos (CRUD)   | ✅    | ✅      | 👁 ver    |
| Importar Censo        | ✅    | ❌      | ❌        |
| Usuários (CRUD)       | ✅    | ❌      | ❌        |
| Relatórios            | ✅    | ✅      | ❌        |

---

## 📥 Importação do Censo Escolar

1. Acesse **Importar Censo** (somente admin).
2. Faça upload do CSV ou XLSX do INEP — o sistema reconhece automaticamente as colunas:
   `CO_ENTIDADE`, `NO_ENTIDADE`, `NO_MUNICIPIO`, `SG_UF`, `TP_SITUACAO_FUNCIONAMENTO`, `TP_DEPENDENCIA`, `TP_LOCALIZACAO`, `DS_ENDERECO`.
3. Linhas sem `INEP` ou `nome` são ignoradas; existentes são atualizadas (sem duplicar).
4. As escolas aparecem automaticamente na seleção das O.S.

> Onde baixar o Censo: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar/resultados

---

## 📡 Principais endpoints (API REST)

> Prefixo: `/api/v1` — todos exigem `Authorization: Bearer <token>` (exceto `/auth/login`).

### Auth
- `POST /auth/login` — `{ email, password }`
- `GET  /auth/me`

### Usuários (admin)
- `GET    /users?q=&role=&active=&page=&limit=`
- `POST   /users`
- `PUT    /users/:id`
- `DELETE /users/:id`

### Escolas
- `GET  /schools?q=&situacao=&municipio=&page=&limit=`
- `GET  /schools/options?q=` (autocomplete)
- `POST /schools/import/censo` (multipart `file`, admin)

### Equipamentos
- `GET/POST/PUT/DELETE /equipment`

### Ordens de Serviço
- `GET    /orders?q=&status=&priority=&school=&technician=&inep=&patrimonio=&late=true&from=&to=&page=&limit=`
- `POST   /orders`
- `GET    /orders/:id`
- `PUT    /orders/:id`
- `PATCH  /orders/:id/status` — `{ status, note? }`
- `POST   /orders/:id/comments` — `{ text, internal }`
- `POST   /orders/:id/attachments` — multipart `files[]`
- `DELETE /orders/:id/attachments/:attId`
- `DELETE /orders/:id` (admin)

### Dashboard / Relatórios / Notificações
- `GET /dashboard/summary`
- `GET /reports/orders/excel?from=&to=&status=&technician=&school=`
- `GET /reports/orders/pdf`
- `GET /reports/orders/by-technician`
- `GET /reports/orders/by-school`
- `GET /reports/equipment/most-maintained`
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

---

## ☁️ Deploy em produção

### MongoDB Atlas
1. Crie cluster gratuito.
2. Crie usuário com senha.
3. Libere IP `0.0.0.0/0` (ou IPs da Render/Railway).
4. Copie a **connection string** e cole em `MONGODB_URI` no backend.

### Supabase Storage
1. Crie um projeto em https://supabase.com.
2. Em **Storage**, crie um bucket público chamado `os-files`.
3. Copie a `Project URL` e a `Service Role Key`.
4. Defina `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` no backend.

### Backend (Render ou Railway)

1. Crie um novo **Web Service** apontando para `/backend`.
2. **Build command**: `npm install`
3. **Start command**: `npm start`
4. Configure todas as variáveis do `.env.example`.
5. **CORS_ORIGIN** = URL do frontend (ex.: `https://os-semed.vercel.app`).

### Frontend (Vercel)

1. Importe o repositório no [Vercel](https://vercel.com/new).
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite (auto)
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. Adicione variável `VITE_API_URL` apontando para a URL pública do backend.
7. O arquivo `vercel.json` já configura **rewrites SPA** (refresh em rotas internas funciona).

### Frontend (Netlify)

1. **Build command**: `npm run build`
2. **Publish directory**: `dist`
3. O arquivo `netlify.toml` + `public/_redirects` já garantem o suporte a SPA.

### Frontend (genérico — "Deploy")
Qualquer hospedagem estática serve a pasta `dist` gerada por `npm run build`.
Lembre-se de configurar **fallback para `index.html`** para que as rotas funcionem após refresh.

---

## 🧰 Scripts NPM

### Backend
```bash
npm run dev     # desenvolvimento com nodemon
npm start       # produção
npm run seed    # cria o admin definido no .env
```

### Frontend
```bash
npm run dev      # vite dev server
npm run build    # build de produção (./dist)
npm run preview  # preview do build
```

---

## 🔒 Segurança implementada

- 🛡 **Helmet** (headers de segurança)
- 🚦 **express-rate-limit** (anti brute-force)
- 🧼 **express-mongo-sanitize** (anti NoSQL injection)
- 🗜 **compression** (gzip)
- 🔐 **JWT** com expiração configurável
- 👮 **RBAC** por rota (admin / técnico / atendente)
- ✅ **Validações Zod** em body / query / params
- 📁 **Multer** com whitelist de mime e limite de tamanho
- 📊 **Logs** estruturados com Winston + Morgan
- ⚠️ **Tratamento global de erros** com mensagens amigáveis

---

## 📝 Licença

MIT — uso livre para a Secretaria Municipal de Educação de Abaetetuba.

Feito com ❤️ pela equipe de T.I.
