# GitGalaxy

GitGalaxy convierte perfiles públicos de GitHub en sistemas solares explorables. El MVP está dirigido a navegadores de escritorio con teclado y requiere WebGL.

## Requisitos

- Node.js 22 o posterior
- pnpm 10
- Un navegador de escritorio actual con WebGL

## Desarrollo

```bash
pnpm install
pnpm dev
```

Vite mostrará la URL local de desarrollo en la terminal. Puedes abrir directamente un perfil con `/<usuario>` (por ejemplo, `/octocat`); la aplicación consulta la REST API pública de GitHub desde el navegador sin autenticación ni token.

Al atravesar por completo el cinturón exterior puedes usar un agujero de gusano para visitar un perfil público aleatorio con al menos 15 repositorios. La transición mantiene el sistema de origen intacto hasta que GitHub confirma y carga el destino; no requiere backend ni token.

Las respuestas válidas se guardan en `localStorage` durante 15 minutos. El TTL se configura en milisegundos mediante `VITE_GITHUB_CACHE_TTL_MS`:

```bash
VITE_GITHUB_CACHE_TTL_MS=300000 pnpm dev
```

## Verificaciones

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium # solo la primera vez
pnpm test:e2e
```

Para ejecutar las dos suites de tests:

```bash
pnpm test:all
```

## Compilación estática

```bash
pnpm build
pnpm preview
```

El artefacto estático se genera en `dist/` y puede desplegarse directamente en Vercel u otro servicio de hosting estático. `vercel.json` redirige las rutas de perfiles a la aplicación para que enlaces como `/octocat` funcionen al abrirlos directamente. En otros servicios debes configurar el fallback de SPA hacia `index.html`. No requiere backend, autenticación ni base de datos.
