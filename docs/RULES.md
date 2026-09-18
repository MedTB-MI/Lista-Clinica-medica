# Lista Clínica — inventario de reglas activas

Versión del inventario: 2026-09-18. Los identificadores son estables. Si una regla cambia, se actualiza su contenido sin reutilizar el ID para otro propósito.

## Autoridad y salida

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| SYS-001 | Prioridad: dato nuevo crudo → intervención explícita del día → informe nuevo → reglas canónicas → lista anterior → estilo histórico. | Determinística |
| SYS-002 | Una fuente inferior no puede contradecir una superior. | Determinística |
| SYS-003 | La salida clínica es una única línea, sin encabezados, comentarios ni Markdown. | Determinística |
| SYS-004 | No inventar datos, fechas, abreviaturas, estudios, resultados, diagnósticos ni causalidad. | Determinística |
| SYS-005 | Elegir la versión más breve cuando dos expresiones contienen la misma información. | Parcial: requiere equivalencia semántica |
| SYS-006 | No reconstruir toda la historia: actualizar, conservar, reemplazar o eliminar cada elemento previo. | Parcial |
| SYS-007 | No modificar la certeza del informe; preservar «probable», «posible», «compatible», «impresiona» y «a descartar». | Parcial |

## Laboratorio

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| LAB-001 | Para todo parámetro medido hoy, el valor nuevo es el valor principal. | Determinística |
| LAB-002 | Ignorar unidades, rangos, métodos, alertas automáticas, comentarios técnicos y datos administrativos. | Determinística para formatos reconocidos |
| LAB-003 | No completar valores ausentes. | Determinística |
| LAB-004 | Orden preferido: Hto, Hb, GB, Plaq, U, Cr, Iono, minerales, EAB, Hep, Coag, inflamatorios, especiales, microbiología, imágenes. | Determinística |
| LAB-005 | No reorganizar agresivamente una lista previa que ya sea clara. | Parcial |
| LAB-006 | Hemograma: `Hto`, `Hb`, `GB`, `Plaq`; `m` puede expresar miles. | Determinística |
| LAB-007 | No agregar automáticamente VCM, HCM, CHCM, RDW, linfocitos, monocitos ni eosinófilos. | Determinística |
| LAB-008 | El diferencial se agrega sólo cuando es útil y queda asociado a GB. | Parcial: «útil» no está formalizado |
| LAB-009 | Si hay blastos relevantes usar `GB [valor]m B[porcentaje]%`; no usar `N0%` como sustituto. | Determinística |
| LAB-010 | Iono usa `Iono Na/K/Cl`. | Determinística |
| LAB-011 | No conservar un ionograma previo trivial. | Parcial |
| LAB-012 | EABv = venoso; EABa = arterial; mantener estructura previa y no interpretar. | Determinística para formatos reconocidos |
| LAB-013 | Una glucosa medida hoy se incluye; una glucosa de la lista previa que no se repite se elimina según LAB-018. | Determinística |
| LAB-014 | Parámetros opcionales (Alb, LDH, ferritina, ProBNP, TSH, GGT, ácido úrico, CMV, serologías) se incluyen si ya se siguen o son claramente relevantes. | Parcial |
| LAB-015 | Las variantes crudas se reconcilian por concepto interno: `Plaq`/`PLAQUETAS`/`PLAQUETAS RECUENTO`/`RECUENTO DE PLAQUETAS`; `Cr`/`CREATININA`/`CREATININA EN SANGRE`; `U`/`Urea`/`UREA EN SANGRE`; `GB`/`RECUENTO DE GLOBULOS BLANCOS`; `Hb`/`HEMOGLOBINA`; `Hto`/`HEMATOCRITO`; `PrT`/`PROTEINAS TOTALES`; `Alb`/`ALBUMINA`; `CaI`/`CALCIO IONICO`; `P`/`FOSFORO`; `Mg`/`MAGNESIO`. | Determinística |
| LAB-016 | Cuando la lista previa usa `Urea`, una actualización conserva ese rótulo; cuando usa `U`, conserva `U`. | Determinística |
| LAB-017 | En una tendencia de GB con blastos aprobada, ambos recuentos se compactan a una cifra decimal y el diferencial actual se expresa como `[porcentaje]%B`. | Determinística para el patrón aprobado |
| LAB-018 | Una glucosa previa no medida nuevamente no se arrastra de forma automática. | Determinística |
| LAB-019 | `PrT`, `Alb`, `GGT` y `Tacrol` son conceptos independientes del bloque `Hep`; reconocer uno no autoriza a fabricar ni reemplazar los otros. | Determinística estructural |
| LAB-020 | Un estudio `Ecodop Hep` se segmenta como estudio independiente y no se adjunta al valor precedente de laboratorio. | Determinística estructural |
| LAB-021 | En informes hospitalarios multilínea, cada resultado se extrae dentro de la sección delimitada por su encabezado de analito. Las líneas de método, confirmación, alerta, unidad y rango no son resultados y no se permite cruzar al analito siguiente. | Determinística estructural |

## Tendencias y previos

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| PREV-001 | El valor actual va primero. | Determinística |
| PREV-002 | Default: no agregar valor previo entre paréntesis. | Determinística |
| PREV-003 | Conservar un previo sólo si aporta: cambio marcado, deterioro/recuperación, valor crítico, intervención o tendencia útil. | No completamente determinística |
| PREV-004 | Ante duda sobre un previo trivial, omitirlo. | Determinística como política conservadora |
| PREV-005 | Habitualmente conservar como máximo un previo. | Determinística |
| PREV-006 | Dos o más previos sólo si muestran una tendencia especialmente importante. | No completamente determinística |
| PREV-007 | Al llegar un nuevo marcador, reducir historia innecesaria; ejemplo: `PCR 120 (193)`. | Parcial |
| PREV-008 | Para Alb, Ca, P, Mg y ácido úrico no conservar un previo por defecto. | Determinística |
| PREV-009 | No usar umbrales matemáticos rígidos para decidir relevancia. | Incompatible con automatización completa sin una regla sustituta aprobada |
| PREV-010 | Un estudio especial no repetido y todavía útil se conserva exactamente, incluidos sus previos. | Parcial: «útil» no está formalizado |
| PREV-011 | Casos cuantitativos aprobados por LC-ERR-001: `Hb 8.5 → 7` conserva `(8.5)`; `Cr 0.54 → 0.76` omite previo; `Urea 35 → 24` omite previo; `Plaq 311 → 27` conserva `(311)`. | Determinística para estos patrones; la matriz general sigue abierta en A-001 |
| PREV-012 | Caso cuantitativo aprobado por LC-ERR-002: `Cr 1.02 → 0.76` conserva `(1.02)`. | Determinística para este patrón; la matriz general sigue abierta en A-001 |

## Intervenciones

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| INT-001 | La intervención queda pegada al valor correspondiente. | Determinística |
| INT-002 | Si el valor previo contiene una intervención y hoy existe valor nuevo del mismo parámetro, conservar el previo completo. | Determinística |
| INT-003 | INT-002 tiene prioridad sobre omitir previos triviales y sobre parámetros secundarios. | Determinística |
| INT-004 | Reconocer como mínimo `+K`, `+P`, `+Mg`, UGR y UP. | Determinística |
| INT-005 | Conservar otras intervenciones explícitas asociadas al valor. | Parcial: vocabulario abierto |
| INT-006 | No modificar ni perder una intervención informada. | Determinística |

## Hepatograma y coagulación

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| HEP-001 | Abreviatura obligatoria: `Hep`. | Determinística |
| HEP-002 | Orden: BD/BT/GOT/GPT/FA. | Determinística |
| HEP-003 | Hepatograma aproximadamente habitual y sin aporte adicional: `Hep sp`. | Parcial: faltan umbrales y definición de «aproximadamente» |
| HEP-004 | No usar `Hepato s/p`, `Hep s/p` ni `Hepato sp`; normalizarlos a `Hep sp`. | Determinística |
| HEP-005 | Puede conservarse un previo sólo en el componente importante. | Parcial |
| HEP-006 | Si una lista previa ya usa hepatograma extendido de ocho componentes y el nuevo informe contiene los cinco componentes de `Hep` más GGT, proteínas totales y albúmina, se conserva la estructura histórica; si cambia un único componente, el previo se adjunta sólo a ese componente. No se infieren normalidad ni relevancia clínica. | Determinística estructural; alcance clínico abierto en A-009 y A-010 |
| COAG-001 | Coagulación aproximadamente normal: `Coag sp`. | Parcial: faltan rangos formales |
| COAG-002 | Si hay alteración, conservar los componentes relevantes. | Parcial |
| COAG-003 | Un `Coag sp` nuevo no se agrega si la lista previa no seguía coagulación. Si ya se seguía, la medición nueva puede actualizarla. | Determinística para persistencia |

## Orina y microbiología

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| URI-001 | Orina sin elementos inflamatorios/infecciosos: `OC no inflamatorio`. | Parcial: requiere interpretación del sedimento |
| URI-002 | Hematuria o proteinuria aisladas no obligan a llamarla inflamatoria. | Parcial |
| MIC-001 | Abreviaturas admitidas: HC, UC, BAL, Cult Qx, FARES, KPC, CD, LMF. | Determinística |
| MIC-002 | Mantener fecha cuando diferencia muestras. | Determinística |
| MIC-003 | El resultado definitivo reemplaza `pendiente` de la misma muestra. | Determinística si tipo y fecha identifican la muestra |
| MIC-004 | `sin desarrollo` puede compactarse como `neg`. | Determinística |

## Imágenes y procedimientos

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| IMG-001 | No transcribir informes; resumir respuesta clínica, impresión, hallazgo principal, evolución y conducta/seguimiento. | No completamente determinística |
| IMG-002 | Omitir técnica, contraste, calidad, normalidad irrelevante, ateromatosis/degeneración incidental y ganglios no adenomegálicos. | Parcial |
| IMG-003 | Abreviaturas de estudios admitidas: TC Tx, TC SNC, TC AP, TC Cer, AngioTC, RMN SNC, RMN órbita, RMN col, RxTx, Eco♥, EcoRV, EcoVC, ETE, ECG, EEG. | Determinística |
| IMG-004 | Hallazgos admitidos: TEP, DP, NTX, OVE, VB IH, bilat, izq, der, comp, dilat, infec/inflam, Fx, HCVI, DAI, IM, IAo, IT, HTP. | Determinística |
| IMG-005 | No inventar abreviaturas fuera del conjunto canónico o de las ya inequívocas en la lista. | Determinística |
| IMG-006 | TC/RMN sin hallazgos relevantes: `sp`. | Parcial: depende del significado del informe |
| IMG-007 | TC protocolo TEP negativa: `TC Tx c/: sin TEP`. | Determinística |
| IMG-008 | TC protocolo TEP positiva: `TC Tx c/: TEP [localización resumida]`. | Parcial: extracción de localización |
| IMG-009 | Si además hay evolución pulmonar relevante, agregarla después. | Parcial |
| IMG-010 | Para evolución usar `<`, `>`, `persiste`, `nuevo`, `resolución` o `sin cambios` sólo si son inequívocos. | Parcial |
| IMG-011 | Un control del mismo problema reemplaza la entrada redundante previa. | Parcial: requiere identidad semántica del problema |
| IMG-012 | Conservar estudios previos de otro territorio, evento o etapa relevante. | Parcial |
| IMG-013 | No mantener dos versiones redundantes del mismo estudio. | Parcial |
| IMG-014 | Para TEP escribir siempre `TEP`; no crear `SEP`, `TP` u otra sigla. | Determinística |
| IMG-015 | Una TC protocolo TEP negativa no se reduce a `sin TEP` cuando además coincide con el patrón aprobado de compromiso intersticial/bronquial bibasal e impresión infecciosa/inflamatoria; se conserva ese hallazgo principal y su incertidumbre. | Determinística para el patrón cerrado aprobado |
| IMG-016 | Los párrafos vacíos internos no separan un informe. Un estudio nuevo comienza sólo ante un encabezado de estudio o microbiología reconocido; título, técnica, descripción e impresión se resumen como una unidad. | Determinística estructural |

## Fechas, privacidad e interfaz

| ID | Regla activa | Estado técnico |
| --- | --- | --- |
| DATE-001 | Agregar fecha sólo si está explícitamente asociada al estudio/muestra. | Determinística |
| DATE-002 | No usar fecha actual, del chat, del laboratorio, de otro estudio ni del comparador. | Determinística |
| PRIV-001 | Todo el procesamiento ocurre en el navegador. | Determinística por arquitectura |
| PRIV-002 | No hay backend, API, IA, login, base de datos, cookies, analytics ni telemetría. | Determinística por arquitectura |
| PRIV-003 | No usar localStorage, IndexedDB ni otra persistencia de contenido clínico. | Determinística por arquitectura |
| PRIV-004 | El contenido desaparece al recargar/cerrar. | Determinística por arquitectura |
| UI-001 | Superficie única: ayer, laboratorios de hoy, estudios de hoy y resultado. | Determinística |
| UI-002 | Acciones: generar, copiar y limpiar. | Determinística |
| UI-003 | Diseño azul, minimalista, prioritariamente de escritorio y usable en móvil. | Determinística |

## Fuentes revisadas

- Prompt troncal y reglas V2 provistos en el encargo.
- Ejemplos y tests canónicos V2 provistos en el encargo.
- Dos muestras de laboratorio crudo en Markdown disponibles en archivos del proyecto.
- Colección histórica de 1.500+ filas de listas clínicas: se usó para inventariar variantes y errores históricos, no como autoridad cuando contradice reglas actuales.
- Búsqueda en Google Drive por nombre y términos del proyecto: no devolvió documentos identificables adicionales de este Gem.

## Correcciones históricas confirmadas

- Normalizar variantes históricas de hepatograma normal a `Hep sp`.
- No convertir blastos en `N0%`.
- No arrastrar automáticamente Alb/Ca/P/Mg/ácido úrico.
- No perder previos con reposición/transfusión.
- No inventar fecha para imágenes sin fecha.
- No inventar siglas alternativas de TEP.
- Reconciliar por concepto canónico aunque cambie el nombre crudo del analito.
- No arrastrar glucosa o FG no repetidos en LC-ERR-001.
- No agregar `Coag sp` nuevo cuando no se venía siguiendo.
- No mutilar el hallazgo pulmonar principal de una TC TEP negativa.
- Separar los conceptos canónicos de hepatograma, GGT, proteínas totales, albúmina y tacrolimus antes del merge.
- Segmentar `Ecodop Hep` como estudio para impedir que quede unido al valor de Mg precedente.
- Extraer resultados hospitalarios por secciones acotadas, sin capturar números de método, rangos ni analitos vecinos.
- Mantener unido un informe radiológico multilínea aunque contenga párrafos vacíos.
