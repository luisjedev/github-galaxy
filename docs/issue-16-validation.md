# Validación de la issue #16

## Evidencias visuales

- Decisión accesible y anclada a la derecha: [`screenshots/issue-16-decision.png`](screenshots/issue-16-decision.png)
- Túnel procedural con la nave centrada: [`screenshots/issue-16-tunnel.png`](screenshots/issue-16-tunnel.png)
- Llegada al sistema y resumen del nuevo usuario: [`screenshots/issue-16-arrival.png`](screenshots/issue-16-arrival.png)

## Peticiones esperadas por viaje

Un salto válido realiza:

1. una petición a `GET /search/users?q=type:user repos:>=15&per_page=100&page=1`;
2. una segunda petición de Search solo si el índice uniforme cae fuera de la primera página;
3. una petición al perfil candidato;
4. una o más páginas de repositorios, reutilizando `loadGitHubSystem` y su caché con TTL.

Por tanto, el caso mínimo con una página de repositorios requiere **3 peticiones** por viaje. El caso normal con un destino situado en otra página de Search requiere **4**. Los candidatos actuales, recientes o que ya no cumplen 15 repositorios se reintentan hasta un máximo de cinco intentos. Las páginas de Search válidas se reutilizan únicamente dentro del intento de viaje; las respuestas fallidas nunca quedan fijadas en caché.

Search y los endpoints de perfil/repositorios conservan errores de límite diferenciados. Las cabeceras `retry-after` y `x-ratelimit-reset` se traducen a una espera comprensible. No se usa backend, autenticación ni token.

## Rendimiento y memoria

Se ejecutaron tres saltos consecutivos en Chromium a 1280×800, con movimiento reducido y sistemas vacíos deterministas. Después de cada llegada permaneció exactamente un `canvas` y el heap usado fue 37,2 MB, 36,9 MB y 34,7 MB respectivamente. Las tres navegaciones consumieron 11 peticiones en total: dos para el origen y tres por salto. No se observó crecimiento sostenido de heap, escenas Three.js duplicadas ni degradación visible del vuelo.

La transición mantiene montada una sola escena de origen, congelada mientras carga. La llegada remonta la exploración con una clave de sistema nueva, liberando geometrías, listeners y el estado de vuelo anterior.

## Automatización

`tests/e2e/wormhole.spec.ts` cubre el cruce único, bloqueo de controles, quedarse sin Search, query de selección, túnel, espera de datos, URL canónica, respawn de llegada, movimiento reducido, respuestas tardías, red, rate limit, candidato actual, reintentos y ausencia de viajes superpuestos. Las funciones puras de límite, histéresis, radios y selección están cubiertas en `src/domain/wormhole.test.ts` y `src/domain/orbital-generation.test.ts`.
