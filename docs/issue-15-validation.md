# Validación visual y de rendimiento — issue #15

## Límites explícitos

| Detalle | Calidad normal | Calidad reducida |
| --- | ---: | ---: |
| Lunas por planeta | 3 | 1 |
| Objetos artificiales por planeta | 2 | 1 |
| Grupos interiores | 4 | 2 |
| Rocas por grupo interior | 12 | 6 |
| Asteroides del cinturón | 320 | 96 |
| Eventos de estrella fugaz por ciclo | 8 | 0 |
| Estrellas fugaces simultáneas | 1 | 0 |
| Bandas por anillo | 5 | 3 |

Los repositorios plantilla conservan un anillo garantizado. Los demás planetas tienen una probabilidad sembrada del 36 %. Todos los límites y descriptores se calculan una sola vez por sistema y nivel de calidad.

## Validación automatizada

- `src/domain/orbital-generation.test.ts` cubre sistemas de 0, 1 y 20 planetas en ambos niveles de calidad, con y sin `appearance.hasRing`.
- Las pruebas comprueban determinismo, valores finitos, cantidades, escalas, inclinaciones, opacidades, velocidades y separación entre superficie, anillo, lunas y objetos artificiales.
- El cinturón se valida más allá de la superficie del planeta exterior y con un radio mínimo estable para sistemas vacíos.
- `tests/e2e/github-system.spec.ts` valida las cantidades observables según la calidad, la posición exterior del cinturón y adjunta una captura sin snapshots de píxeles dependientes de GPU.
- Las pruebas de vuelo, interacción y colisión existentes siguen siendo la frontera funcional: los detalles no incorporan marcadores, fichas ni cuerpos físicos.

## Capturas sembradas

Chromium, viewport 1440 × 900, renderizador de software y calidad reducida:

- [Sistema vacío con cinturón exterior](screenshots/issue-15-empty.png)
- [Sistema pequeño con planetas, anillos y grupos](screenshots/issue-15-small.png)
- [Sistema de 20 planetas](screenshots/issue-15-full.png)

## Coste de render aproximado

Los 96/320 asteroides del cinturón comparten **un draw call**. Cada grupo interior comparte otro, de modo que todas las rocas requieren como máximo 5 draw calls en calidad normal y 3 en reducida. Las lunas se agrupan por sus dos siluetas low-poly dentro del espacio local de cada planeta; cada planeta usa como máximo 2 batches de lunas. Los objetos artificiales reutilizan hasta 4 batches por planeta que tenga alguno (cuerpo, panel, sonda y señal). Cada banda transparente de un anillo conserva un draw call para permitir huecos, anchuras y opacidades diferentes. La estrella fugaz reutiliza permanentemente dos meshes y solo se hace visible durante un evento.

No se crean o destruyen geometrías, materiales ni timers durante la animación. Las actualizaciones por frame se limitan a matrices de instancias, transformaciones de grupos y uniforms/materiales ya existentes; no hay estado React ni generación procedural dentro del bucle.

## Revisión manual

En Chromium headless con SwiftShader se cargaron y capturaron los sistemas vacío, pequeño y de 20 planetas. El selector activó calidad reducida; no hubo cierres del contexto WebGL ni crecimiento visible de recursos durante las recargas de la suite. Este entorno no ofrece una cifra de FPS representativa: antes de publicar conviene confirmar fluidez en Chrome/Edge/Firefox con aceleración GPU.

Comprobar manualmente además que:

1. las lunas siguen al planeta y pasan por delante/detrás sin cortar sus anillos;
2. las bandas transparentes no producen z-fighting desde vistas rasantes;
3. el cinturón permanece detrás de la UI y fuera de la última órbita;
4. las estrellas fugaces son excepcionales y quedan ocultas por cuerpos cercanos;
5. `prefers-reduced-motion` elimina por completo las estrellas fugaces.
