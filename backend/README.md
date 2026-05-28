# Backend — OS Abaetetuba

API REST do sistema de Ordens de Serviço da T.I. da Secretaria de Educação de Abaetetuba.

## Stack
- Node.js + Express (arquitetura MVC)
- MongoDB + Mongoose
- JWT + RBAC (admin, tecnico, atendente)
- Supabase Storage (com fallback local)
- Helmet, Rate Limit, Compression, Sanitização
- Zod (validações)
- ExcelJS + PDFKit (relatórios)
- Multer + XLSX (uploads e importação Censo Escolar)

## Instalação

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

A API sobe em `http://localhost:5000/api/v1`.
Um usuário admin é criado automaticamente conforme `.env` (SEED_ADMIN_*).

## Scripts
- `npm run dev` — dev com nodemon
- `npm start` — produção
- `npm run seed` — cria o usuário admin definido em .env

## Estrutura

```
src/
  config/          # env, database, supabase
  controllers/     # camada HTTP
  middlewares/     # auth, validate, upload, errorHandler
  models/          # mongoose
  routes/          # endpoints
  services/        # regras de negócio (auth, storage, import, report, notification)
  validations/     # zod
  utils/           # logger, AppError, paginate, seed
```

## Endpoints principais

- `POST /api/v1/auth/login`
- `GET  /api/v1/auth/me`
- `GET/POST/PUT/DELETE /api/v1/users` (admin)
- `GET  /api/v1/schools` + `GET /api/v1/schools/options`
- `POST /api/v1/schools/import/censo` (upload CSV/XLSX, admin)
- `GET/POST/PUT/DELETE /api/v1/equipment`
- `GET/POST/PUT/DELETE /api/v1/orders`
  - `PATCH /api/v1/orders/:id/status`
  - `POST  /api/v1/orders/:id/comments`
  - `POST  /api/v1/orders/:id/attachments` (form-data `files`)
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/reports/orders/excel?from=&to=&status=&technician=&school=`
- `GET /api/v1/reports/orders/pdf`
- `GET /api/v1/notifications`

## Deploy (Render / Railway)
- Crie um Web Service Node.
- Build command: `npm install`
- Start command: `npm start`
- Defina todas as variáveis do `.env.example`.
- Configure `MONGODB_URI` para MongoDB Atlas e `SUPABASE_*` para o Storage.
