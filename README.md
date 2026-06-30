# ⚡ VOLT

Control de marcajes (fichajes) para `lupe.nunsys.com`.

## Stack

- **Angular 21** standalone + zoneless + signals, lazy routing con
  _view transitions_.
- **TailwindCSS v4** (vía PostCSS) + un pequeño sistema de diseño propio en
  `src/styles.css`. Sin librerías de componentes.
- Tipografías: _Space Grotesk_ (UI) + _JetBrains Mono_ (datos).

## Estructura

```
src/app/
  core/          servicios, modelos y lógica (auth, marcajes, theme, toast,
                 horarios, utilidades de fecha, modelo del gráfico semanal)
  shared/        componentes reutilizables (logo, toggle de tema, toasts,
                 línea temporal)
  shell/         layout autenticado (rail de navegación)
  pages/         login · dashboard (semana) · fichar
```

## Secciones

- **Login** — acceso.
- **Semana** (`/dashboard`) — métricas + línea temporal semanal animada
  (las barras "se cargan", la jornada en curso late en cian, con marcador de
  "ahora"). Navegación por semanas. Incluye un **fichaje rápido**: un botón
  grande que ficha _ahora_ detectando solo si toca entrada o salida según el
  estado actual, más un atajo de "día completo" con el horario recordado. Al
  fichar, la semana se recarga al instante. Las selecciones (horario y
  teletrabajo) se recuerdan en `localStorage` (`volt-prefs`).
- **Fichar** (`/fichar`) — marcaje puntual y "día completo". Cada horario
  muestra en todo momento el total resultante (min–max).
- **Ajustes** (`/ajustes`) — editor de horarios (añadir/quitar horarios y
  marcajes, entrada/salida, horas, teletrabajo) y de la **aleatoriedad** con un
  _slider de rango de dos puntos_. Cada tramo de trabajo varía su duración en un
  valor aleatorio dentro del rango, de modo que con _P_ tramos el total queda en
  `[nominal + P·min, nominal + P·max]` (p. ej. 8–9 y 10–11 con ±5 min →
  **1h 50m – 2h 10m**). Todo se persiste en `localStorage`.

## Desarrollo

```bash
npm install
npm start        # ng serve  → http://localhost:4200
npm run build    # build de producción en dist/volt
```

> La app llama directamente a los endpoints de `lupe.nunsys.com`
> (ver `src/app/core/config.ts`). La sesión se guarda en `localStorage`.
