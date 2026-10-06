# Wayvibe

Mapa web con tu ubicación real y rutas personalizadas: la más rápida, la más turística, con sombra, con restaurantes o tranquila.

## Qué hace

- Muestra un mapa real del mundo y dónde estás (calle, barrio y ciudad).
- Busca cualquier sitio, o mantén pulsado el mapa para elegir un punto.
- Calcula el tiempo a pie, en bici, en coche y en metro o camión, todo dentro de la app. Metro y camión usan solo horarios reales de Transitous, explicados paso a paso (dónde subir, dirección, paradas, dónde bajar y transbordos). Si la ciudad no publica horarios, la app lo dice y no inventa una ruta.
- Si no se puede llegar de una forma (por ejemplo, hay agua de por medio), lo dice en vez de inventar un camino.
- Opción "sin escaleras" para silla de ruedas, carriola o bastón: rutas a pie sin escalones y transporte con acceso sin escalones cuando hay datos.
- Navegación paso a paso con voz y vibración: el mapa te sigue, te dice la próxima vuelta y recalcula si te sales de la ruta.
- Lugares cercanos reales (restaurantes, cafés, metro, farmacias, parques, cajeros) con horario, teléfono y accesibilidad cuando OpenStreetMap los tiene.
- "¿Qué tipo de camino prefieres?": Turística, Con vistas, Con sombra, Con restaurantes o Tranquila. La caja de texto solo entiende estos filtros y la opción sin escaleras; si escribes otra cosa, te dice qué puedes pedir.
- Puedes elegir el punto de partida (buscándolo o manteniendo presionado el mapa) e invertir salida y destino. Si no hay GPS, te pide desde dónde sales en vez de fallar.
- Lista "Lugares que quiero visitar": toca ♡ Guardar en cualquier lugar y lo encuentras en el botón Guardados (se guarda solo en tu teléfono).
- "Turística" con tres niveles: 1 Lo básico (solo lo más famoso, con artículo en Wikipedia), 2 + Museos (museos, miradores y monumentos), 3 Todo. Solo cuenta sitios reales con nombre, cada uno una vez, y te dice cuáles son. "Con vistas" es aparte: miradores, jardines, fuentes, plazas y calles peatonales.
- Si el celular cierra la app, al abrirla retoma tu última ruta.
- Vibi, la mascota de Wayvibe (un pin redondito con un brote en la cabeza, parado sobre un mapa): te saluda con una animación al abrir la app, piensa mientras busca la ruta, se pone triste cuando no se puede llegar, duerme sin conexión y celebra con confeti cuando llegas.
- Aguanta fallas: si un servidor no responde, reintenta y usa uno de respaldo (rutas con OSRM, búsqueda con Nominatim, lugares con otros espejos de Overpass, mapa con OpenStreetMap). Sin señal te avisa y reintenta solo cuando vuelve.
- Durante la navegación mantiene la pantalla encendida y avisa si el GPS está débil o perdido.
- Se puede instalar en el celular ("Agregar a pantalla de inicio") y abre sin conexión con los mapas que ya viste. Si la librería del mapa no carga, la busca en un segundo servidor, y si tu navegador no puede dibujar mapas te dice cómo arreglarlo en vez de dejar la pantalla en blanco.
- Idiomas: español, inglés, portugués, francés, coreano, chino, japonés y ruso. Las indicaciones paso a paso en coreano y chino salen en inglés porque el servidor de rutas no tiene esos idiomas. Las etiquetas del mapa cambian también.

## Servicios (gratis, sin claves)

| Para qué | Servicio |
| --- | --- |
| Mapa | [OpenFreeMap](https://openfreemap.org) + [MapLibre GL](https://maplibre.org) |
| Búsqueda | [Photon](https://photon.komoot.io) |
| Dirección actual | [Nominatim](https://nominatim.org) |
| Rutas | [Valhalla](https://valhalla1.openstreetmap.de) (FOSSGIS) |
| Metro y camión | [Transitous](https://transitous.org) |
| Lugares, líneas de transporte y datos de accesibilidad | [Overpass API](https://overpass-api.de) |

Son servidores públicos con límites de uso justo. Si la app crece, conviene usar servidores propios o un proveedor de pago.

## Ejecutar en local

Es una web estática, sin compilación:

```sh
python3 -m http.server 8000
```

Abre http://localhost:8000. La ubicación solo funciona en `localhost` o con HTTPS.
