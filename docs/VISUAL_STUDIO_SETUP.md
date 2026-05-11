# Guia para trabajar el proyecto en Visual Studio Code / Visual Studio

## 1. Clonar el repositorio

```bash
git clone https://github.com/rafaelconwiro/real-time-sales-coaching.git
cd real-time-sales-coaching
```

## 2. Editor recomendado

Para este proyecto se recomienda **Visual Studio Code**, no Visual Studio clasico, porque el stack propuesto es TypeScript/Node/Next.js/NestJS.

Visual Studio puede servir si luego se agrega .NET, pero para el MVP actual VS Code es mas rapido y natural.

## 3. Extensiones recomendadas de VS Code

Instalar:

- ESLint
- Prettier
- Prisma
- Docker
- GitLens
- Thunder Client o REST Client
- Tailwind CSS IntelliSense
- Error Lens
- DotENV

## 4. Requisitos locales

Instalar:

- Node.js LTS
- pnpm
- Docker Desktop
- Git
- PostgreSQL local opcional, aunque se recomienda Docker
- Redis local opcional, aunque se recomienda Docker

Comprobar versiones:

```bash
node -v
pnpm -v
docker -v
git --version
```

## 5. Crear estructura inicial del monorepo

Cuando se implemente el codigo, usar esta estructura:

```bash
mkdir -p apps/web apps/api packages/shared packages/prompts prisma docs
```

Inicializar workspace:

```bash
pnpm init
```

Crear `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## 6. Crear frontend Next.js

```bash
cd apps
pnpm create next-app web --ts --eslint --tailwind --app --src-dir --import-alias "@/*"
cd ..
```

## 7. Crear backend NestJS

Instalar Nest CLI:

```bash
pnpm add -g @nestjs/cli
```

Crear API:

```bash
cd apps
nest new api
cd ..
```

Si Nest pregunta por package manager, elegir pnpm.

## 8. Docker para PostgreSQL y Redis

Crear `docker-compose.yml` en la raiz:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: sales_coach_postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: salescoach
      POSTGRES_PASSWORD: salescoach
      POSTGRES_DB: salescoach
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: sales_coach_redis
    restart: unless-stopped
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Levantar servicios:

```bash
docker compose up -d
```

## 9. Variables de entorno

Copiar ejemplo:

```bash
cp .env.example .env
```

Variables minimas:

```env
DATABASE_URL="postgresql://salescoach:salescoach@localhost:5432/salescoach?schema=public"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY=""
JWT_SECRET="change-me"
APP_URL="http://localhost:3000"
API_URL="http://localhost:4000"
```

## 10. Prisma

Instalar en backend:

```bash
cd apps/api
pnpm add prisma @prisma/client
pnpm prisma init
```

Mover o centralizar `schema.prisma` segun decision del monorepo.

Ejecutar migraciones:

```bash
pnpm prisma migrate dev
```

Abrir DB visualmente:

```bash
pnpm prisma studio
```

## 11. Scripts recomendados en package.json raiz

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api start:dev",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  }
}
```

## 12. Puertos recomendados

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Prisma Studio: normalmente `http://localhost:5555`

## 13. Primer flujo para probar

Antes de implementar audio real, crear una simulacion textual.

### Backend

Endpoint/WebSocket:

```txt
client:transcript.manual_chunk
```

Payload:

```json
{
  "sessionId": "...",
  "speaker": "prospect",
  "text": "Ahora mismo lo vemos caro y no sabemos si es prioridad."
}
```

Respuesta:

```json
{
  "stage": "discovery",
  "missingFields": ["budget", "decisionMaker", "impact"],
  "recommendation": {
    "type": "question",
    "title": "Profundiza antes de defender precio",
    "suggestedPhrase": "Cuando dices caro, ¿comparado con que alternativa o coste actual lo estas midiendo?"
  }
}
```

### Frontend

Crear pantalla:

```txt
/session/demo
```

Componentes:

- TranscriptSimulator
- CurrentStageCard
- MissingFieldsChecklist
- LiveRecommendationCard
- SignalsTimeline

## 14. Orden correcto de implementacion local

1. Monorepo y scripts.
2. Docker PostgreSQL/Redis.
3. Prisma schema basico.
4. API con healthcheck.
5. Web con dashboard minimo.
6. WebSocket API.
7. Simulador textual.
8. Motor de recomendacion simple sin IA.
9. Integracion IA para live analysis.
10. Playbook Builder.
11. Transcripcion real.

## 15. Comando diario de desarrollo

```bash
git pull
pnpm install
pnpm db:up
pnpm dev
```

## 16. Regla de disciplina

No avanzar a audio real hasta que el simulador textual genere recomendaciones utiles. Si el motor falla con texto perfecto, con audio real sera mucho peor.
