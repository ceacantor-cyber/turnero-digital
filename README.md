# Turnero Digital

Turnero Digital es una aplicación React + Express + tRPC para registrar turnos, consultar la cola y operar llamados individuales con los perfiles de Yury y Jonathan.

## Stack portable

- React, Vite y TypeScript para la interfaz.
- Express y tRPC para la API.
- Drizzle ORM con PostgreSQL.
- Render para el servicio web.
- Supabase o Neon para PostgreSQL persistente.

La versión para Render usa PostgreSQL en lugar del MySQL administrado por Manus. El esquema y la migración inicial están en `drizzle/schema.ts` y `drizzle-pg/0000_perfect_maximus.sql`.

## Ejecutar localmente

Requisitos: Node.js 20+, pnpm 10+ y una base PostgreSQL.

```bash
pnpm install
cp .env.example .env
# Edita DATABASE_URL con una conexión PostgreSQL real
pnpm db:migrate
pnpm dev
```

La aplicación queda disponible en `http://localhost:3000`. La comprobación de salud es `GET /api/health`.

## Subir a GitHub

Crea un repositorio vacío en GitHub y ejecuta desde esta carpeta:

```bash
git init
git add .
git commit -m "feat: preparar turnero para Render y PostgreSQL"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

No subas `.env`, contraseñas ni el valor real de `DATABASE_URL`. El archivo `.gitignore` ya excluye esos archivos.

## Desplegar en Render

1. En Render selecciona **New > Web Service** y conecta el repositorio de GitHub.
2. Usa `render.yaml` mediante **Blueprint** o configura manualmente:
   - Build command: `pnpm install --frozen-lockfile && pnpm build`
   - Start command: `pnpm db:migrate && pnpm start`
   - Health check path: `/api/health`
   - Plan: `Free`
3. Crea una base PostgreSQL en Supabase o Neon y copia su cadena de conexión completa.
4. En las variables de entorno de Render agrega `DATABASE_URL` como secreto y establece `NODE_ENV=production`.
5. Despliega. El comando de inicio aplica la migración antes de arrancar la aplicación.

## Persistencia y límites del plan gratuito

La aplicación no guarda turnos en el disco local del servicio. Los turnos se guardan en PostgreSQL, por lo que no se pierden cuando Render reinicia o duerme el servicio.

El servicio web gratuito de Render puede dormir después de inactividad y tardar aproximadamente un minuto en despertar. Render documenta además que sus bases PostgreSQL gratuitas expiran después de 30 días, por lo que esta guía recomienda usar una base gratuita externa como Supabase o Neon para evitar esa limitación específica. Ningún proveedor garantiza que un plan gratuito sea indefinido; hay que revisar sus límites y políticas vigentes.

## Operación

El panel está en `/operador` y usa la contraseña configurada por el proyecto. Las acciones de llamar, repetir, poner en atención, finalizar y omitir se validan en el servidor. Los turnos pendientes y el historial se consultan desde PostgreSQL.

## Comandos de verificación

```bash
pnpm check
pnpm build
curl http://localhost:3000/api/health
```
