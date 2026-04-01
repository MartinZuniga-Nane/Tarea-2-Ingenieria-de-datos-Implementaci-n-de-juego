# Arcade Library - Duel

Proyecto web modular en JavaScript puro con `p5.js` y `ml5.js` para un launcher estilo biblioteca y un juego de duelo controlado por gestos.

## Como correrlo
Opción A:
- Utilizar docker compose up --build en la raiz

Opción B:
- Sirvelo con un servidor estatico local. No abras `index.html` directo porque el proyecto usa modulos ES y camara.
- Opcion simple: VS Code + Live Server.
- Opcion Node: `npx serve .` o cualquier servidor estatico equivalente.
- Abre la URL local en el navegador y concede permisos de camara si quieres usar HandPose.

## Controles

- `A` = izquierda
- `D` = derecha
- `W` = subir
- `S` = bajar
- `Enter` = confirmar
- `Space` = disparar
- `Esc` = volver o salir

## Gestos soportados

- Mano abierta = confirmar / continuar / disparar en combate
- Indice apuntando a la izquierda = navegar a la izquierda
- Indice apuntando a la derecha = navegar a la derecha
- Dos dedos = bajar
- Tres dedos = subir

## Estructura

- `index.html`: punto de entrada
- `css/`: estilos base, launcher y HUD del juego
- `js/launcher/`: biblioteca y tarjetas reutilizables
- `js/shared/`: scene manager, asset loader, input por gestos, cooldowns y UI comun
- `js/games/duel/`: configuracion, escenas, entidades y sistemas del juego principal
- `assets/games/duel/`: backgrounds, logo y sprites base de modelos reutilizables
- `libs/`: cargadores locales para p5.js y ml5.js desde CDN

## Convencion de assets

- Fondos: `assets/games/duel/backgrounds/BG1.png`, `BG2.png`, `BG3.png`, `FondoJuego.png`, `SombraGeneral.png`
- Logo: `assets/games/duel/logo/Logo.png`
- Sprites base actuales: `assets/games/duel/models/model1/<state>.png` y `assets/games/duel/models/model2/<state>.png`
- En codigo, cada `player` elige un `modelo`; ambos players pueden repetir el mismo modelo o elegir distintos
- Estados esperados por modelo: `normal`, `prepare`, `attack`, `victory`, `defeat`, `effect1`, `effect2`

## Nota sobre modelos

- `Player 1` y `Player 2` no estan atados a un sprite fijo: ambos seleccionan un modelo de la lista.
- Para agregar mas personajes/modelos, basta con sumar otro set de sprites y una nueva entrada en `js/games/duel/config.js` y `js/games/duel/duelAssets.js`.

## Debug

- Activa el panel de debug desde `js/games/duel/config.js` cambiando `debug.enabled` y `debug.showVideo` a `true`.
- El adapter de HandPose esta abstraido en `js/shared/input/handposeAdapter.js` para tolerar cambios entre versiones de `ml5`.
