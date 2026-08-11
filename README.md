# Canada Trip 2026 — planificador compartido

Sitio: **https://jantdonda.github.io/canada-trip/** (se activa tras el primer despliegue de GitHub Pages, puede tardar 1-2 min en estar disponible).

## Cómo editar el itinerario

Todo el contenido de la app (días, actividades, vuelos, tren, alojamiento) vive en un único archivo: **`data.json`**. La página lo lee automáticamente, así que cualquier cambio que guardéis ahí se refleja en el sitio en cuanto GitHub termine de desplegarlo (normalmente menos de 1 minuto).

### Pasos para editar (sin instalar nada)

1. Entra en el repositorio: https://github.com/jantdonda/canada-trip
2. Abre el archivo `data.json`.
3. Pulsa el icono del lápiz (✏️) arriba a la derecha del archivo, o simplemente entra en modo edición.
4. Cambia lo que necesites (ver ejemplos abajo).
5. Baja al final de la página y pulsa **"Commit changes..."** → **"Commit directly to the main branch"** → **Commit changes**.
6. Espera ~30-60 segundos y recarga la web — el cambio ya estará publicado.

> Consejo: si el JSON tiene algún error de sintaxis (falta una coma, comilla sin cerrar...) la página puede dejar de cargar. GitHub te avisa igualmente al hacer commit si el formato no es válido. Si tienes dudas, pégamelo aquí en el chat y te lo reviso.

### Ejemplos de edición

**Añadir una actividad a un día concreto** — busca el día por su fecha (`"date": "2026-08-24"`) dentro de `"days"` y añade un elemento a su lista `"activities"`:

```json
{
  "time": "10:00",
  "title": "Visit the Royal Ontario Museum",
  "type": "activity",
  "status": "confirmed",
  "details": "Tickets booked online"
}
```

**Quitar una actividad**: borra ese bloque `{ ... }` de la lista (recuerda no dejar una coma suelta al final o al principio).

**Marcar algo como confirmado**: cambia `"status": "pending"` por `"status": "confirmed"` (cambia el color de la etiqueta en la web).

**Rellenar un vuelo, tren o alojamiento**: dentro de `"documents"` están `"flights"`, `"trains"` y `"accommodations"` — sustituye los `"TBD"` por los datos reales (número de vuelo, aerolínea, nombre del hotel, dirección, localizador...).

## Pendiente de confirmar

- Fecha exacta de llegada a Toronto (¿madrugada del 22 o del 23 de agosto?).
- Números de vuelo y aerolíneas (Málaga→Lisboa, Lisboa→Toronto, Montreal→Lisboa, Lisboa→Málaga).
- Tren Toronto→Montreal: operador, número, localizador.
- Alojamiento en Toronto (¿mismo hotel en ambos tramos?), Sudbury y Montreal.
- Actividades día a día — se pueden ir añadiendo cuando estén decididas.

## Estructura del proyecto

- `index.html` — estructura de la página
- `style.css` — estilos (tema rojo/blanco, inspirado en Canadá)
- `app.js` — lee `data.json` y pinta el contenido
- `data.json` — **el único archivo que necesitáis tocar para actualizar el itinerario**
