# Validación visual y de rendimiento — issue #14

## Qué se valida automáticamente

- `src/domain/visual-generation.test.ts` comprueba determinismo, valores finitos y límites de cantidad, distancia, escala, color y opacidad para espacio profundo, nebulosas, polvo y superficies.
- La misma suite cubre sistemas con cero y veinte planetas; mundos archivados, neutrales, vacíos y con anillo; y los seis rasgos (`bands`, `craters`, `dunes`, `facets`, `islands`, `ridges`).
- `tests/e2e/github-system.spec.ts` usa API, viewport y datos fijos para validar la semilla visual, el nivel de calidad, las cantidades acotadas y los biomas observables. Adjunta una captura de la composición sin comparar píxeles exactos entre GPU.
- Las pruebas E2E existentes continúan validando vuelo, turbo, interacción, marcadores, guía y colisiones.

## Revisión visual manual

Capturas de referencia a 1440 × 900 en Chromium:

- [Sistema sin planetas](screenshots/issue-14-empty.png)
- [Sistema con seis biomas/estados](screenshots/issue-14-biomes.png)

Revisar manualmente en Chrome, Edge y Firefox que:

1. las nebulosas no muestran rectángulos y permanecen detrás de la navegación;
2. la corona, atmósferas y motores brillan sin quemar la silueta;
3. la UI resulta legible sobre zonas claras y oscuras;
4. el fondo sigue rodeando la cámara al alejarse del origen;
5. `prefers-reduced-motion` elimina el parpadeo y reduce pulsaciones y partículas.

Safari continúa como soporte secundario conforme a `spec.md`.

## Calidad y coste

La calidad se decide una vez al montar la escena. Se usa el nivel reducido con cuatro núcleos o menos, DPR superior a 2 o renderizado por software; reduce DPR, estrellas, polvo, detalle geométrico, sombras y actividad estelar. El bloom selectivo se construye con capas Fresnel y geometrías aditivas acotadas en estrella, atmósferas y motores; así no requiere un framebuffer de postprocesado y evita parpadeos en GPU integradas.

Medición de producción local (`pnpm build`, Node 22, Vite 8):

| Versión | JS minificado | JS gzip |
| --- | ---: | ---: |
| `main` antes de #14 | 1,110.38 kB | 306.71 kB |
| #14 | 1,130.32 kB | 313.09 kB |
| Diferencia | +19.94 kB | +6.38 kB |

No se añadieron texturas, modelos, recursos remotos ni una dependencia de postprocesado.

## Rendimiento manual

Entorno disponible: Chromium headless, viewport 1440 × 900, renderizador de software, macOS. El selector eligió correctamente calidad reducida. Se recorrieron los escenarios vacío, seis biomas y veinte planetas durante la suite E2E sin fugas o cierres de contexto observados. Este entorno no permite afirmar una cifra de FPS representativa de GPU; la meta cercana a 60 FPS debe confirmarse en Chrome/Edge/Firefox sobre un portátil moderno con aceleración gráfica antes de publicar.
