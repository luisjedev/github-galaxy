# Validación de superficies planetarias — issue #17

## Evidencia visual sembrada

Viewport fijo de 1440 × 900 en Chromium, con ocho repositorios que cubren tres mundos TypeScript del mismo lenguaje, biomas adicionales, métricas extremas, plantilla, planeta vacío y archivado:

- Antes: [composición de biomas de #14](screenshots/issue-14-biomes.png)
- Después: [superficies procedurales de #17](screenshots/issue-17-procedural-surfaces.png)

La captura es una referencia de composición para detectar regresiones grandes; no se compara píxel a píxel entre GPU.

## Semántica y arquitectura

`generatePlanetVisual` produce un descriptor puro, finito y determinista antes de tocar Three.js. La semilla define orientación, escala y umbral de regiones, detalle secundario, formaciones correlacionadas y rasgo secundario. Las métricas se acotan con escalas logarítmicas:

- tamaño: complejidad y escala del patrón;
- estrellas: cantidad e intensidad de parches emisivos localizados;
- forks: redes de vetas/fracturas; cero forks produce intensidad cero;
- actividad: atmósfera, capas selectivas y velocidad sutil;
- archivado: anula capas dinámicas y emisión;
- lenguaje/bioma: conserva paleta, accidentes y vocabulario visual;
- plantilla: conserva el significado previo del anillo.

Las ondas direccionales usan posiciones 3D normalizadas. No emplean UV, por lo que no introducen costura longitudinal ni un tratamiento especial inestable en los polos. El relieve desplaza los vértices radialmente hasta un máximo del 4 % del radio visual; no modifica ningún radio lógico de colisión, atmósfera o información.

## Calidad, movimiento y GPU

La calidad normal usa icosaedro de detalle 2, dos octavas, más formaciones y más parches. La reducida conserva exactamente orientación y regiones principales, pero usa detalle 1, una octava y menos instancias/capas.

Por planeta se conserva un material de superficie y geometría facetada propios, un draw call instanciado para formaciones y, solo cuando la semántica lo habilita, hasta dos draw calls instanciados para capa dinámica y emisión. No hay texturas, modelos, servicios ni assets remotos. Geometrías y el material shader creado manualmente se liberan al desmontar; no se asigna estado React por frame. `prefers-reduced-motion` congela la rotación independiente de nubes/auroras.

Build local (Node 22, Vite 8):

- JavaScript minificado: 1,178.52 kB
- JavaScript gzip (Vite): 326.95 kB
- incremento minificado frente al artefacto local anterior: 6.01 kB

## Verificación

Automática:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

Las pruebas puras cubren determinismo, límites, los ocho biomas, seis rasgos superficiales, extremos de métricas, radio mínimo, calidad normal/reducida, archivado, sin lenguaje, vacío, plantilla y varios repositorios del mismo lenguaje. La prueba E2E expone semilla y métricas en la observabilidad accesible y adjunta una captura sembrada.

Validación disponible: Chromium headless, 1440 × 900, macOS y renderizador de software. La suite recorrió escenas de cero y veinte planetas y varios sistemas sin errores WebGL, cierres de contexto ni degradación sostenida observada. Este entorno no permite declarar FPS representativos; Chrome, Edge y Firefox con aceleración gráfica siguen siendo la comprobación manual recomendada para hardware representativo, además de Safari como soporte secundario.
