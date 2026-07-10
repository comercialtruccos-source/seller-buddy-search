## Objetivo
Una plataforma de una sola vista para que tus vendedores consulten referencias del inventario, con buscador por **Referencia** y mostrando los precios **detal (PVP)** y **mayorista (PVM)**. Todo funciona en el navegador con **localStorage**, sin backend.

## Cómo funcionará
1. **Subir inventario (CSV)**: un botón "Cargar inventario" permite seleccionar un archivo CSV con el mismo formato del que enviaste. Al subirlo:
   - Se parsea y se guarda en `localStorage`.
   - Se registra automáticamente la **fecha y hora** de esa carga como "última actualización".
2. **Persistencia**: al recargar la página, los datos y la fecha se leen de `localStorage` (no hay que volver a subir el archivo).
3. **Buscador**: campo de búsqueda por **Referencia** (ej: `B01020061`). Coincidencia parcial e insensible a mayúsculas para que sea rápido de usar.
4. **Resultados en la misma página**: al buscar, debajo aparece la ficha de la referencia:
   - Encabezado: Referencia + Descripción.
   - Precios destacados: **Detal (PVP)** y **Mayorista (PVM)**, formateados en pesos (ej: `$164.900`).
   - Tabla de variantes con: Talla, Color, Saldo (stock) y SKU.
   - Total de unidades disponibles (suma de saldos).
5. **Indicador de última actualización**: siempre visible en la parte superior, mostrando la fecha y hora en que se cargó el inventario por última vez (ej: "Inventario actualizado: 10 jul 2026, 3:45 p. m."). Si aún no se ha cargado nada, invita a cargar el CSV.

## Formato del CSV esperado
Columnas: `Referencia, Descripción, Talla - Lote, Color, Saldo, Talla, CodColor, SKU, PVM UNIT, PVP UNIT`
- `PVP UNIT` → precio **detal**
- `PVM UNIT` → precio **mayorista**
- `Saldo` → stock disponible por variante

## Diseño
- Diseño limpio y comercial (tarjetas, tipografía clara, buen contraste), pensado para uso rápido en escritorio o móvil.
- Estados vacíos claros: "sin inventario cargado" y "no se encontró la referencia".

## Notas técnicas
- Vista única en `src/routes/index.tsx` con componentes auxiliares en `src/components/`.
- Parseo de CSV con una función ligera propia (maneja comas y encabezados); sin dependencias nuevas salvo que se prefiera `papaparse`.
- Estado guardado en `localStorage` bajo una clave (ej: `inventario_data` y `inventario_actualizado`), leído en un `useEffect` para evitar problemas de hidratación SSR.
- Agrupación de filas por `Referencia` para armar la ficha con sus variantes.
- Metadatos de la página (título/descripción) actualizados en el `head` de la ruta.

## Consideración importante
`localStorage` es **local a cada navegador/dispositivo**. Con esta opción, cada vendedor debe subir el CSV en su propio dispositivo (o tú lo subes en cada uno). Si más adelante quieres que subas el archivo una sola vez y todos lo vean automáticamente, se requeriría un backend (Lovable Cloud); lo dejo anotado por si lo necesitas después.