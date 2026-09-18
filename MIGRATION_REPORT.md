# Informe de migración — Lista Clínica Web

## 1. Reglas encontradas

Se inventariaron 73 reglas activas con identificadores estables en `docs/RULES.md`. Cubren autoridad de fuentes, contrato de salida, laboratorio, tendencias, intervenciones, hepatograma, coagulación, microbiología, imágenes, fechas, privacidad e interfaz.

Fuentes revisadas:

- prompt troncal y reglas V2 entregadas;
- ejemplos y tests canónicos V2;
- dos laboratorios crudos en Markdown;
- colección histórica de más de 1.500 filas de listas clínicas;
- búsqueda por nombre y contenido en Google Drive (sin documentos adicionales identificables del Gem).

## 2. Contradicciones o ambigüedades

Se documentaron ocho en `docs/AMBIGUITIES.md`. Las dos que bloquean el deploy clínico definitivo son:

- A-001: decidir cuándo una variación es clínicamente relevante sin usar umbrales rígidos.
- A-005: resumir y reconciliar informes radiológicos libres sin interpretación semántica.

También quedan abiertos «aproximadamente normal», parámetros opcionales, diferencial, identidad de muestras sin fecha, vocabulario abierto de intervenciones y ubicación de intervenciones en la interfaz.

## 3. Cantidad de tests

37 tests de regresión.

## 4. Tests que pasan/fallan

- Pasan: 37.
- Fallan: 0.
- Build TypeScript/Vite: aprobado.
- Respuesta HTTP local: aprobada.
- Auditoría estática de privacidad: sin APIs de red, persistencia, cookies, analytics ni telemetría en el código o el build.
- Verificación visual automatizada: no ejecutable en este entorno porque no hay navegador instalado y el CDN del navegador está bloqueado. No afecta los tests del motor; la revisión visual final debe hacerse antes de publicar.

## 5. Partes determinísticas

- actualización de valores actuales;
- orden y formato de campos reconocidos;
- parsing de laboratorio compacto y tablas Markdown conocidas;
- blastos como `B%`;
- intervenciones +K, +P, +Mg, UGR y UP;
- conservación obligatoria de previos con intervención;
- omisión de previos triviales de parámetros secundarios;
- normalización `Hep sp`;
- persistencia literal de especiales no repetidos;
- reemplazo microbiológico por tipo/fecha;
- TEP negativo/positivo en patrones canónicos;
- fechas sólo si están explícitas;
- preservación de estudios históricos distintos;
- salida en una única línea.

## 6. Partes que todavía requieren interpretación

- relevancia de tendencias no ejemplificadas;
- selección de diferencial leucocitario fuera de blastos;
- decisión de incluir un parámetro opcional nuevo;
- normalidad aproximada sin rango/flag del laboratorio;
- resumen de radiología libre no coincidente con patrones cerrados;
- identidad de una muestra microbiológica sin fecha cuando hay más de una pendiente;
- equivalencia semántica entre estudios evolutivos complejos.

La app no inventa estos resultados: muestra una advertencia de revisión y conserva la información previa cuando corresponde.

## 7. Qué se construyó

- Vite + TypeScript, sin React;
- motor de reconciliación modular;
- interfaz única azul y responsive;
- botones Generar, Copiar y Limpiar;
- procesamiento exclusivamente en memoria;
- CSP `connect-src 'none'`;
- sin backend, base, login, almacenamiento, cookies, IA, analytics o telemetría;
- documentación de reglas, ambigüedades y privacidad;
- CI de GitHub con tests y build;
- build estático en `dist/`.

## 8. Qué necesita hacer Tomás

Antes de publicar para uso clínico:

1. Aprobar una matriz determinística de tendencias por parámetro o aceptar que la app pida revisión humana para esos casos.
2. Elegir un contrato para imágenes: sólo texto ya compactado, patrones cerrados + revisión manual, o un paso humano externo de resumen. Sin IA en producción, no existe una forma confiable de convertir cualquier informe libre automáticamente.
3. Probar visualmente en una computadora y un teléfono con datos sintéticos.
4. Recién después, subir a GitHub y conectar Cloudflare Pages.

## 9. Pasos exactos para Cloudflare Pages

No ejecutar el deploy clínico definitivo hasta cerrar A-001 y A-005.

### GitHub

1. Crear un repositorio vacío llamado `Lista-Clinica-Web`.
2. Descargar y descomprimir `Lista-Clinica-Web.zip`.
3. Abrir PowerShell dentro de la carpeta descomprimida y ejecutar:

```bash
git init -b main
git add .
git commit -m "Versión inicial de Lista Clínica Web"
git remote add origin https://github.com/TU_USUARIO/Lista-Clinica-Web.git
git push -u origin main
```

### Cloudflare Pages

1. Abrir Cloudflare Dashboard.
2. Ir a **Workers & Pages**.
3. Elegir **Create application** → **Pages** → **Import an existing Git repository**.
4. Autorizar GitHub y seleccionar `Lista-Clinica-Web`.
5. Configurar:
   - Production branch: `main`
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
   - Environment variables: ninguna
6. Cuando las ambigüedades estén cerradas, pulsar **Save and Deploy**.
7. Abrir la URL generada y verificar con datos sintéticos: generar, copiar, limpiar, recargar y confirmar que los campos quedan vacíos.
8. En DevTools → Network, confirmar que al generar no aparece ninguna solicitud nueva.
