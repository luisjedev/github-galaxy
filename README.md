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

Vite mostrará la URL local de desarrollo en la terminal.

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

El artefacto estático se genera en `dist/` y puede desplegarse directamente en Vercel u otro servicio de hosting estático. No requiere backend, autenticación ni base de datos.
