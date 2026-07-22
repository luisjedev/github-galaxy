# GitGalaxy — Especificación del MVP

## Problem Statement

Las personas con un perfil público de GitHub no disponen de una forma visual, inmediata y entretenida de contemplar su actividad como un conjunto coherente. Las páginas habituales de GitHub presentan repositorios y métricas mediante listas, tarjetas y tablas; son útiles, pero no despiertan la misma curiosidad que una representación espacial explorable.

GitGalaxy debe permitir que cualquier visitante escriba un nombre de usuario de GitHub y vea sus proyectos públicos propios convertidos en un sistema solar tridimensional. El propósito del MVP no es ofrecer objetivos, puntuaciones ni progresión, sino satisfacer la curiosidad de descubrir cómo se ve un perfil como universo navegable. La prioridad es que la experiencia funcione de forma fiable, resulte fácil de controlar y tenga una presentación visual y sonora atractiva.

## Solution

GitGalaxy será una aplicación web de escritorio que genera de forma procedural y determinista un sistema solar a partir del perfil público de GitHub indicado por el visitante.

El usuario de GitHub se representará mediante una estrella central interactiva y sus repositorios públicos propios mediante un máximo de veinte planetas. El tamaño, aspecto, estado y órbita de cada planeta comunicarán datos del repositorio. El visitante pilotará una nave low-poly en tercera persona, se acercará a los cuerpos celestes para consultar sus detalles y podrá abrir el perfil o repositorio correspondiente en una pestaña nueva.

La experiencia tendrá estética low-poly de ciencia ficción, con colores intensos y ambiente inspirado de manera general en la sensación de exploración de *No Man’s Sky*, sin copiar sus recursos, diseños ni propiedad intelectual. Los modelos, efectos, música y sonidos iniciales serán procedurales y autocontenidos.

La aplicación podrá abrir un sistema desde el menú principal o directamente mediante el query parameter `user`. El MVP será una aplicación estática, desplegada en Vercel, que consumirá la API pública de GitHub directamente desde el navegador y no requerirá cuenta, autenticación ni backend.

## User Stories

1. Como visitante, quiero introducir un nombre de usuario de GitHub en el menú principal, para generar su sistema solar.
2. Como visitante, quiero iniciar la carga pulsando un botón claro o confirmando el campo, para entrar rápidamente en la experiencia.
3. Como visitante, quiero abrir una URL que contenga el parámetro `user`, para cargar directamente un sistema sin pasar por el formulario.
4. Como visitante, quiero que la URL refleje el usuario cargado, para poder compartir el sistema con otras personas.
5. Como visitante, quiero ver un estado de carga con información comprensible, para saber que el perfil y la escena se están preparando.
6. Como visitante, quiero recibir un mensaje específico si el usuario no existe, para corregir el nombre introducido.
7. Como visitante, quiero recibir un mensaje específico si GitHub limita las solicitudes, para entender que el problema es temporal.
8. Como visitante, quiero recibir un mensaje recuperable ante errores de red o de la API, para poder reintentar o volver al menú.
9. Como visitante, quiero ver una estrella aunque el perfil no tenga repositorios propios, para que un sistema vacío siga siendo un resultado válido.
10. Como visitante, quiero que el perfil de GitHub sea la estrella central del sistema, para reconocer quién da origen al universo generado.
11. Como visitante, quiero acercarme a la estrella y consultar avatar, nombre, biografía, seguidores y enlace al perfil, para conocer al propietario del sistema.
12. Como visitante, quiero abrir el perfil de GitHub desde su ficha, para continuar explorándolo en una pestaña nueva.
13. Como visitante, quiero que cada repositorio público propio seleccionado sea un planeta, para visualizar los proyectos del perfil.
14. Como visitante, quiero que los forks del usuario no se representen como planetas, para que el sistema refleje únicamente proyectos propios.
15. Como visitante, quiero que el sistema limite la escena a veinte planetas, para conservar la legibilidad y el rendimiento.
16. Como visitante, quiero que los veinte repositorios se seleccionen combinando popularidad, actividad y tamaño, para ver una muestra relevante del perfil.
17. Como visitante, quiero que el tamaño de un planeta refleje el tamaño del repositorio sin crear extremos inmanejables, para comparar proyectos visualmente.
18. Como visitante, quiero que el lenguaje principal influya en el color o bioma del planeta, para reconocer tecnologías de un vistazo.
19. Como visitante, quiero que un repositorio archivado aparezca como un planeta gris o muerto, para percibir su estado sin excluirlo.
20. Como visitante, quiero que un repositorio vacío aparezca como un planeta muy pequeño, para que siga formando parte del sistema.
21. Como visitante, quiero que un repositorio sin lenguaje detectado use un aspecto rocoso neutral, para evitar una representación engañosa.
22. Como visitante, quiero que un repositorio configurado como plantilla tenga un anillo distintivo, para identificar esa característica.
23. Como visitante, quiero que la actividad reciente influya en la distancia orbital, para que la disposición tenga significado.
24. Como visitante, quiero ver órbitas lentas, rotación planetaria y líneas orbitales tenues, para que el sistema se sienta vivo sin dificultar la navegación.
25. Como visitante, quiero que un mismo perfil produzca el mismo sistema, para que los enlaces compartidos representen una escena reconocible.
26. Como visitante, quiero pilotar una nave en tercera persona, para explorar el sistema de forma directa.
27. Como visitante, quiero controlar toda la navegación principal con teclado, para no depender de un ratón o trackpad.
28. Como visitante, quiero avanzar, frenar y usar reversa con `W` y `S`, para controlar el desplazamiento de la nave.
29. Como visitante, quiero girar con `A` y `D`, para orientar la nave horizontalmente.
30. Como visitante, quiero descender y subir directamente con `J` y `K`, para moverme en tres dimensiones sin un simulador de vuelo complejo.
31. Como visitante, quiero activar el turbo con `Espacio`, para atravesar rápidamente distancias largas.
32. Como visitante, quiero que la cámara siga automáticamente a la nave, para mantener una vista útil sin manipularla con el trackpad.
33. Como visitante, quiero que mi nave tenga colores, luces y estela asociados a los lenguajes dominantes del perfil, para sentir que también representa al usuario cargado.
34. Como visitante, quiero que la nave se detenga al alcanzar la atmósfera de una estrella o planeta, para evitar atravesar cuerpos celestes.
35. Como visitante, quiero ver un aviso de peligro al tocar una atmósfera, para entender que la nave no está preparada para atravesarla.
36. Como visitante, quiero acercarme a un planeta y ver automáticamente su ficha, para descubrir el repositorio sin interrumpir el pilotaje.
37. Como visitante, quiero que la ficha muestre nombre, descripción, lenguaje, estrellas, forks, tamaño y última actualización, para entender el proyecto representado.
38. Como visitante, quiero pulsar `E` cerca de un planeta para abrir el repositorio, para decidir explícitamente cuándo salir a GitHub.
39. Como visitante, quiero que el repositorio se abra en una pestaña nueva, para conservar el sistema solar abierto.
40. Como visitante, quiero que solo el cuerpo celeste relevante o más cercano active su ficha, para evitar paneles ambiguos cuando haya varios próximos.
41. Como visitante, quiero ver marcadores discretos de los cuerpos relevantes, para orientarme sin llenar la pantalla de interfaz.
42. Como visitante, quiero ver una indicación hacia la estrella cuando quede fuera de pantalla, para poder regresar al centro del sistema.
43. Como visitante, quiero pulsar `R` para regresar cerca de la estrella, para recuperarme si me alejo o me pierdo.
44. Como visitante, quiero que el regreso tenga un periodo de carga y una animación de teletransporte, para que no parezca un salto técnico instantáneo.
45. Como visitante, quiero abrir el menú de pausa con `Esc`, para detener la interacción y acceder a acciones globales.
46. Como visitante, quiero volver al menú y cargar otro perfil, para explorar varios sistemas durante una sesión.
47. Como visitante, quiero escuchar música ambiental, para reforzar la sensación de exploración espacial.
48. Como visitante, quiero escuchar sonidos de motor, turbo, proximidad y teletransporte, para recibir respuesta sonora a mis acciones.
49. Como visitante, quiero poder silenciar todo el audio, para adaptar la experiencia a mi entorno.
50. Como visitante, quiero que el audio comience después de una interacción explícita, para que funcione conforme a las restricciones de reproducción del navegador.
51. Como visitante, quiero una presentación low-poly colorida y coherente, para disfrutar de una escena atractiva sin requerir gráficos fotorrealistas.
52. Como visitante, quiero una experiencia fluida en un portátil moderno, para poder explorar sin hardware especializado.
53. Como visitante de escritorio, quiero recibir controles e instrucciones iniciales visibles, para aprender a pilotar sin ensayo y error.
54. Como visitante desde un dispositivo móvil, quiero ver un aviso de que el MVP requiere escritorio, para entender por qué no puedo jugar correctamente.
55. Como visitante con un navegador sin WebGL, quiero ver un error claro en lugar de una pantalla rota, para conocer la incompatibilidad.
56. Como visitante, quiero que los datos se almacenen temporalmente en mi navegador, para evitar solicitudes repetidas innecesarias a GitHub.
57. Como visitante, quiero que la calidad visual se adapte cuando sea necesario, para mantener una tasa de imágenes estable.
58. Como visitante, quiero que la experiencia no me obligue a iniciar sesión ni entregar un token de GitHub, para explorar perfiles públicos con mínima fricción.

## Implementation Decisions

### Producto y experiencia

- El producto se llamará **GitGalaxy** y el proyecto se denominará `github-galaxy`.
- El MVP es una experiencia de exploración y visualización; no tendrá condiciones de victoria, misiones, puntuación, economía, progresión ni competición.
- La plataforma objetivo es navegador de escritorio con teclado. No se implementarán controles táctiles en el MVP.
- La aplicación tendrá, como mínimo, los estados de menú, carga, exploración, pausa y error.
- La entrada principal permitirá escribir un nombre de usuario de GitHub. La ruta canónica incluirá directamente el usuario, por ejemplo `/octocat`.
- Cuando exista un nombre de usuario válido en la ruta, la carga comenzará directamente. Al cargar desde el menú, la URL se actualizará para producir un enlace compartible.
- Los estados de error distinguirán, al menos, usuario inexistente, límite de API, fallo de red/API y ausencia de WebGL.
- Un perfil válido sin repositorios propios generará una estrella solitaria; no será tratado como error.

### Arquitectura

- Se construirá con React, TypeScript y Vite.
- La escena tridimensional utilizará React Three Fiber sobre Three.js. Se podrán emplear utilidades compatibles del ecosistema cuando reduzcan complejidad sin introducir un motor de juego completo.
- La interfaz de menús, tarjetas, ayudas y errores se implementará como UI web superpuesta a la escena 3D.
- El MVP será una aplicación estática desplegada en Vercel.
- No habrá backend, base de datos, autenticación, token de GitHub, función serverless ni proxy en esta fase.
- La navegación, proximidad y colisiones se calcularán con lógica propia. No se incorporará inicialmente un motor de físicas.
- La aplicación utilizará WebGL y no dependerá de WebGPU.

### Contrato con GitHub

- Solo se consumirán datos públicos de GitHub.
- Se consultará el perfil público del usuario y su colección de repositorios públicos mediante la REST API pública de GitHub.
- Los repositorios se solicitarán con paginación de hasta 100 elementos por página cuando sea necesario.
- Antes de construir el sistema se excluirán los repositorios marcados como fork. Los repositorios archivados, vacíos, sin lenguaje y configurados como plantilla permanecerán incluidos.
- La aplicación almacenará temporalmente respuestas válidas en el navegador para reducir solicitudes repetidas. El valor inicial recomendado para el TTL es de 15 minutos y podrá ajustarse como configuración, no como comportamiento de producto.
- Los errores y cabeceras de rate limit disponibles se traducirán a estados comprensibles; nunca se solicitará al visitante que introduzca un token en el cliente.
- Al no existir backend, el MVP acepta los límites de solicitudes no autenticadas de GitHub como restricción conocida.

### Selección y transformación de repositorios

- Se representará un máximo de veinte repositorios públicos propios.
- La relevancia se calculará con un 40 % de estrellas, un 35 % de actividad reciente y un 25 % de tamaño.
- Las métricas se normalizarán dentro del conjunto de repositorios del perfil.
- Estrellas y tamaño usarán transformaciones logarítmicas para evitar que valores extremos dominen la clasificación.
- La actividad se convertirá en una puntuación de recencia monotónica: una actualización más reciente nunca podrá puntuar peor que una más antigua.
- Los empates se resolverán por fecha de actualización más reciente y, si persisten, mediante un criterio estable basado en el identificador del repositorio.
- El tamaño visual del planeta también usará una escala logarítmica limitada por radios mínimo y máximo.
- El tamaño del repositorio influirá en el radio del planeta; no controlará por sí solo su relevancia ni podrá producir cuerpos invisibles o desproporcionados.
- La fecha de actividad influirá en la distancia orbital: los proyectos más recientes estarán, en términos generales, más cerca del centro. La distribución deberá mantener separaciones seguras entre órbitas.
- El lenguaje principal determinará una familia cromática o bioma. La correspondencia entre lenguaje y apariencia será estable.
- Un repositorio archivado se representará con estética gris, apagada o de planeta muerto.
- Un repositorio sin lenguaje detectado utilizará un planeta rocoso neutral.
- Un repositorio vacío o de tamaño mínimo producirá el planeta más pequeño permitido.
- Un repositorio marcado como plantilla tendrá un anillo visual distintivo.

### Generación determinista

- La generación procedural utilizará semillas estables derivadas del nombre o identificador del usuario y de los identificadores de repositorio.
- Dados los mismos datos normalizados de GitHub, deben conservarse la selección, apariencia, parámetros orbitales y disposición inicial del sistema.
- El orden en que lleguen las respuestas o se iteren objetos no debe modificar el resultado.
- Los cambios legítimos en los datos públicos de GitHub podrán cambiar el sistema después de que expire la caché.
- Las órbitas serán animadas y lentas; su estado inicial será reproducible y la animación no deberá dificultar significativamente la aproximación.

### Estrella y planetas

- El perfil será una estrella central procedural e interactiva.
- La identidad visual de la estrella se derivará de forma estable del perfil y de su paleta tecnológica, sin copiar recursos de terceros.
- Al entrar en el radio de interacción de la estrella se mostrará una ficha con avatar, nombre, nombre de usuario, biografía, número de seguidores y enlace al perfil.
- Cada repositorio seleccionado será un planeta procedural con rotación propia y órbita lenta alrededor de la estrella.
- Se mostrarán líneas orbitales tenues para comunicar estructura sin dominar la escena.
- Al entrar en el radio de proximidad de un planeta se mostrará automáticamente una única ficha del cuerpo más relevante o cercano.
- La ficha de planeta incluirá nombre, descripción, lenguaje principal, estrellas, forks recibidos, tamaño, última actualización y enlace.
- El enlace no se abrirá automáticamente. `E` abrirá el destino del cuerpo interactivo actual en una pestaña nueva.
- Acercarse a la estrella permitirá abrir de la misma manera el perfil público.

### Nave, cámara y movimiento

- La cámara será de tercera persona y seguirá automáticamente a la nave.
- El MVP no requerirá movimientos de ratón o trackpad para pilotar ni orientar la cámara principal.
- La nave usará una silueta base low-poly procedural. No habrá varios modelos de nave en esta fase.
- Los lenguajes dominantes del perfil modificarán de forma determinista colores, luces y estela de la nave, sin cambiar estadísticas jugables.
- `W` acelerará hacia delante y `S` frenará o aplicará reversa.
- `A` y `D` girarán la nave a izquierda y derecha.
- `J` descenderá y `K` subirá mediante cambio directo de altitud, manteniendo un modelo de vuelo arcade y la orientación esencialmente horizontal.
- `Espacio` activará el turbo mientras proceda y se impedirá su comportamiento de scroll cuando la experiencia tenga el foco.
- `E` abrirá el enlace del cuerpo celeste interactivo actual.
- `R` iniciará la secuencia de regreso a la estrella.
- `Esc` abrirá o cerrará el menú de pausa.
- Se podrán mostrar equivalencias de controles en la ayuda, pero los controles anteriores son el contrato del MVP.
- La nave aparecerá cerca de la estrella y orientada hacia un primer destino útil cuando existan planetas.
- Los valores de aceleración, velocidad, giro, ascenso y turbo se ajustarán para un manejo arcade legible, no para simular física espacial realista.

### Colisiones, proximidad y recuperación

- Estrellas y planetas tendrán volúmenes de colisión esféricos sencillos, ampliados para representar su atmósfera o zona de seguridad.
- La nave no podrá atravesar estos cuerpos. Al contactar con el límite atmosférico, su avance hacia el cuerpo se detendrá; no rebotará ni recibirá daño.
- El contacto mostrará un aviso de peligro indicando que la nave no está preparada para atravesar la atmósfera.
- No habrá aterrizaje, entrada atmosférica, destrucción, salud ni vidas.
- La proximidad de información será suficientemente exterior a la colisión para poder leer y abrir la ficha sin tocar la atmósfera.
- Se incluirán marcadores discretos para ayudar a localizar cuerpos relevantes.
- Cuando la estrella quede fuera de pantalla se mostrará una guía direccional hacia ella.
- `R` no teletransportará de inmediato: iniciará una carga visible y audible seguida de una transición animada que colocará la nave cerca de la estrella en una posición segura.
- Durante la secuencia de teletransporte se bloquearán o limitarán las entradas necesarias para evitar estados inconsistentes.

### Dirección artística y assets

- La estética será low-poly, colorida y de ciencia ficción, inspirada en la sensación general de exploración de *No Man’s Sky* pero sin reproducir modelos, música, sonidos, interfaces, nombres o diseños protegidos.
- Estrella, planetas, órbitas, fondos, nave, partículas y efectos se generarán con geometrías, materiales, shaders o sistemas procedurales sencillos.
- El MVP será autocontenido y no dependerá de paquetes de assets visuales externos.
- La prioridad visual será una composición clara, iluminación atractiva, paletas coherentes, siluetas legibles y sensación de profundidad antes que el realismo.
- Las diferencias de lenguaje o estado no dependerán exclusivamente de variaciones cromáticas cuando sea viable; biomas, anillos, luminosidad y otros rasgos podrán reforzar la lectura.

### Audio

- Se incluirán música ambiental, sonido de motor, turbo, proximidad y teletransporte.
- El audio se generará inicialmente de forma procedural mediante Web Audio u otra solución autocontenida; no se reutilizará audio de videojuegos comerciales.
- El motor responderá de forma perceptible al estado de movimiento y el turbo tendrá una señal diferenciada.
- La secuencia de regreso tendrá una carga sonora y un efecto de salto sincronizados con la animación.
- La reproducción comenzará únicamente después de una interacción explícita del visitante, como pulsar “Explorar”, para respetar las políticas de autoplay.
- Habrá un control global de silencio accesible durante la experiencia.
- Los fallos de inicialización de audio no impedirán explorar el sistema.

### Rendimiento y compatibilidad

- El objetivo es aproximarse a 60 FPS en un portátil moderno con gráficos integrados y un sistema de hasta veinte planetas.
- La resolución interna, densidad de píxeles, partículas, sombras u otros efectos costosos podrán adaptarse para mantener fluidez.
- Se limitarán geometrías, materiales, draw calls y efectos de postprocesado según sea necesario.
- Los navegadores principales serán versiones actuales de Chrome, Edge y Firefox.
- Safari tendrá soporte secundario y no bloqueará la entrega inicial si existen diferencias menores no críticas.
- Si WebGL no está disponible, se mostrará un estado de incompatibilidad comprensible.
- En dispositivos móviles se mostrará un aviso indicando que el MVP requiere escritorio; no se prometerá una experiencia táctil funcional.

### Despliegue

- El despliegue objetivo será Vercel.
- El artefacto seguirá siendo estático durante el MVP, aunque Vercel deje abierta la posibilidad de introducir en el futuro caché compartida, proxy o funciones serverless.
- El manejo basado en query parameters no requerirá rutas dinámicas de servidor.
- La configuración de producción deberá preservar el funcionamiento de enlaces compartidos y assets bajo la URL pública.

## Testing Decisions

- Los tests validarán comportamiento observable y contratos de producto; no comprobarán detalles internos de componentes React, jerarquías de Three.js, nombres de shaders ni implementación concreta de Web Audio.
- El seam principal será una prueba end-to-end en navegador con la API de GitHub interceptada mediante respuestas deterministas. Desde ese punto se cubrirán menú, query parameter, carga, escena lista, HUD, controles, proximidad, apertura de enlaces, pausa, teletransporte y errores. Es el seam más alto disponible en un proyecto nuevo y evita fragmentar la mayoría de pruebas entre componentes.
- Las pruebas end-to-end no dependerán de inspeccionar píxeles individuales del canvas para validar lógica. La aplicación expondrá su comportamiento observable mediante interfaz, estados accesibles y efectos de navegación, mientras la escena seguirá siendo el resultado visual real.
- Se añadirá un seam puro y estrecho para la transformación de datos de GitHub, porque clasificación, normalización y semillas deterministas contienen reglas matemáticas importantes que serían difíciles de diagnosticar exclusivamente desde el navegador.
- Las pruebas de transformación cubrirán exclusión de forks, límite de veinte, pesos 40/35/25, transformaciones logarítmicas, desempates estables, repositorios sin lenguaje, vacíos, archivados y plantillas.
- Las pruebas deterministas comprobarán que una entrada idéntica produce parámetros idénticos, que el orden de entrada no cambia el resultado y que un cambio relevante de datos puede cambiar el sistema de manera controlada.
- Las pruebas end-to-end cubrirán al menos los siguientes escenarios de API: perfil normal con más de veinte repositorios, perfil sin repositorios propios, usuario inexistente, límite de solicitudes y fallo de red.
- Se comprobará que `/<usuario>` inicia la carga, que el menú actualiza la URL y que un nombre inválido conduce a un estado recuperable.
- Se comprobará que solo se muestra la ficha del cuerpo próximo activo, que `E` abre su URL en una pestaña nueva y que no se abre ningún enlace sin una acción explícita.
- Se comprobará que los controles de teclado modifican externamente el estado de navegación esperado, que la pausa detiene la interacción correspondiente y que el navegador no ejecuta scroll por `Espacio` durante el pilotaje.
- Se comprobará que la colisión detiene la nave antes de atravesar el cuerpo y hace visible el aviso atmosférico, sin daño ni rebote.
- Se comprobará que `R` inicia primero la carga de teletransporte y solo después sitúa la nave en una zona segura cercana a la estrella.
- Se comprobará el control de silencio y que la ausencia o bloqueo de AudioContext no impide que la escena llegue al estado explorable.
- Se realizará una validación visual acotada en un navegador de referencia con un sistema sembrado y datos fijos. Las capturas servirán para detectar regresiones grandes de composición, no como sustituto de pruebas funcionales ni como comparación estricta propensa a fallos por GPU.
- Se realizará una prueba manual de rendimiento con cero, veinte y varios tipos de planetas en hardware representativo. El criterio será navegación fluida y ausencia de degradaciones graves; el objetivo de 60 FPS es una meta de rendimiento, no una garantía idéntica para todo hardware.
- Se realizarán comprobaciones manuales básicas en Chrome, Edge, Firefox y Safari, dando prioridad de corrección a los tres primeros.
- Al ser un proyecto nuevo y vacío, no existe prior art de tests en el código actual. Se establecerán estos seams como convención inicial y se evitarán tests unitarios de componentes puramente presentacionales.

## Out of Scope

- Convertir commits en cometas u otras entidades espaciales.
- Representar seguidores, organizaciones, issues, pull requests, contribuciones, releases, branches u otros objetos de GitHub fuera de los datos de perfil necesarios y repositorios seleccionados.
- Mostrar todos los repositorios cuando existan más de veinte planetas elegibles.
- Repositorios privados y autenticación con GitHub.
- Backend, proxy de API, caché compartida, base de datos o funciones serverless.
- Cuentas propias de GitGalaxy, perfiles internos, favoritos o historial sincronizado.
- Objetivos, misiones, puntuaciones, logros, progresión, recursos, economía o competición.
- Multijugador o presencia de otras naves.
- Combate, daño, salud, vidas, destrucción o respawn por accidente.
- Aterrizaje, entrada en atmósferas, superficies explorables o interiores de planetas.
- Simulación orbital o de vuelo físicamente realista.
- Modelos múltiples de nave, personalización manual o piezas modulares.
- Generar la geometría de la nave a partir del avatar.
- Cámara libre o controles de cámara dependientes del ratón/trackpad.
- Radar o minimapa completo.
- Controles táctiles, soporte jugable móvil o aplicación nativa.
- Soporte prioritario para navegadores antiguos, ausencia de WebGL o WebGPU obligatorio.
- Assets comerciales o recursos copiados de *No Man’s Sky* u otros juegos.
- Pistas musicales externas durante la primera versión procedural.
- Internacionalización completa; el idioma inicial de la interfaz se decidirá durante implementación sin ampliar el alcance funcional.
- Analítica, telemetría de producto o seguimiento del visitante.
- Optimización SEO más allá de los metadatos básicos de una aplicación web.

## Further Notes

- El repositorio todavía no existe y la carpeta de trabajo estaba vacía al redactar esta especificación. No hay ADRs, glosario de dominio ni convenciones previas que deban conservarse.
- El vocabulario de dominio inicial es: **sistema** para la escena generada de un perfil, **estrella** para el perfil, **planeta** para un repositorio seleccionado, **nave** para el vehículo del visitante, **atmósfera** para el límite de colisión y **teletransporte** para el regreso animado a la estrella.
- “Que se vea bien” significa para este MVP: dirección low-poly coherente, composición legible, movimiento fluido, iluminación y color atractivos, feedback visual/sonoro y ausencia de assets sin terminar; no significa alcanzar fidelidad gráfica de un videojuego comercial.
- La API pública no autenticada es una restricción deliberada del MVP. Si la aplicación gana uso real, el siguiente paso técnico probable será evaluar un proxy con token protegido y caché compartida en Vercel.
- La selección de veinte repositorios reemplaza la idea inicial de crear tantas entidades como objetos devuelva la API. Ese crecimiento se reserva para iteraciones posteriores y deberá preservar legibilidad y rendimiento.
- Los detalles exactos de paletas, radios, velocidades, distancias, duración del teletransporte y curvas de audio se ajustarán durante implementación, respetando los contratos de comportamiento aquí definidos.
- No había un issue tracker ni vocabulario de etiquetas configurado en el directorio vacío, por lo que esta especificación se entrega como documento local y no se publica ni etiqueta como `ready-for-agent`.
