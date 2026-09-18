# Lista Clínica — Exámenes Complementarios

Aplicación web estática que reconcilia una lista previa con laboratorio y estudios nuevos. Todo ocurre en el navegador; no hay backend, IA ni persistencia.

## Uso local

```bash
npm install
npm run dev
```

## Validación

```bash
npm run check
```

## Build estático

```bash
npm run build
```

La salida queda en `dist/` y es compatible con Cloudflare Pages.

## Cloudflare Pages

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Variables/secretos: ninguno

El archivo `public/_headers` aplica una CSP con `connect-src 'none'` para impedir envíos desde el navegador.

## Estado de migración

Ver [docs/RULES.md](docs/RULES.md) y [docs/AMBIGUITIES.md](docs/AMBIGUITIES.md). El deploy clínico definitivo está bloqueado hasta formalizar las decisiones de tendencias e interpretación radiológica libre.
