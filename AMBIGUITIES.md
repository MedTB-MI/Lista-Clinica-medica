# Contradicciones y ambigüedades que bloquean un deploy clínico definitivo

## A-001 — Relevancia de tendencias

Las reglas ordenan conservar sólo cambios «marcados», «críticos» o «clínicamente útiles», pero también prohíben umbrales matemáticos rígidos. Un programa sin IA necesita una definición ejecutable. La versión actual sólo automatiza con certeza:

- previos con intervención explícita;
- ejemplos canónicos cubiertos por reglas ya aprobadas;
- omisión de previos triviales explícitamente ejemplificados;
- persistencia literal de estudios especiales no repetidos.

Todo otro cambio cuantitativo se marca para revisión y se resuelve con una política conservadora documentada en el motor. Antes del deploy asistencial hay que aprobar una matriz por parámetro o aceptar una interacción humana.

## A-002 — «Aproximadamente normal»

`Hep sp` y `Coag sp` dependen de rangos, sexo, edad, laboratorio y contexto. El motor sólo usa `sp` cuando el informe aporta normalidad explícita o cuando todos los componentes reconocidos carecen de marcas de anormalidad en un formato con rangos. Si no, conserva valores.

## A-003 — Parámetros opcionales

«Ya se viene siguiendo» es verificable; «claramente relevante» no lo es sin criterio clínico. El motor conserva los ya presentes e incorpora los marcados como anormales. El resto se informa como dato no utilizado para revisión.

## A-004 — Diferencial leucocitario

La utilidad del diferencial no tiene regla cerrada. El motor conserva un diferencial que ya se seguía e incluye blastos siempre. No decide por sí solo si neutrófilos, linfocitos u otras series nuevas son clínicamente relevantes.

## A-005 — Radiología libre

Resumir un informe nuevo, jerarquizar hallazgos, preservar incertidumbre y decidir si reemplaza otro estudio exige interpretación semántica. La versión estática automatiza patrones cerrados (TEP negativo, estudios explícitamente normales, entradas ya compactas y algunos patrones evolutivos). El resto queda marcado para revisión; no se inventa un resumen.

## A-006 — Identidad de muestras microbiológicas

Un resultado sin tipo/fecha sólo puede reemplazar un pendiente si existe una única muestra candidata inequívoca. Con varias muestras, el motor no elige.

## A-007 — Intervenciones fuera del vocabulario conocido

`+K`, `+P`, `+Mg`, UGR y UP están cerrados. «Cualquier otra intervención» es un vocabulario abierto. Las intervenciones desconocidas se preservan si ya están pegadas al valor; no se reasignan automáticamente.

## A-008 — Contradicción de interfaz

El contrato acepta una sección de intervenciones, pero la interfaz solicitada enumera sólo tres entradas y una salida. Para no sumar un quinto casillero, la app admite intervenciones dentro de «Laboratorios de hoy», pegadas al valor o bajo una línea `Intervenciones:`.

## Decisión de release

La app es apta como prototipo verificable y asistente conservador. No debe considerarse una reproducción completa del Gem ni publicarse para uso clínico rutinario hasta cerrar A-001 y A-005, como mínimo.
