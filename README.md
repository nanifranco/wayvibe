# Wayvibe

Mapa web con tu ubicación real y rutas personalizadas: la más rápida, la más turística, con sombra, con restaurantes o tranquila.

## Qué hace

- Muestra un mapa real del mundo y dónde estás (calle, barrio y ciudad).
- Busca cualquier sitio, o mantén pulsado el mapa para elegir un punto.
- Calcula el tiempo a pie, en bici y en coche. Metro y bus se abren en Google Maps con el origen y el destino ya puestos.
- "¿Cómo quieres ir?": elige Turística, Con sombra, Con restaurantes o Tranquila, o escríbelo con tus palabras ("por donde haya cafés y algo de sombra"). La ruta pasa por zonas con más lugares de ese tipo y te dice cuántos minutos añade.
- Idiomas: español, inglés, portugués, francés y coreano. Las etiquetas del mapa cambian también.

## Servicios (gratis, sin claves)

| Para qué | Servicio |
| --- | --- |
| Mapa | [OpenFreeMap](https://openfreemap.org) + [MapLibre GL](https://maplibre.org) |
| Búsqueda | [Photon](https://photon.komoot.io) |
| Dirección actual | [Nominatim](https://nominatim.org) |
| Rutas | [Valhalla](https://valhalla1.openstreetmap.de) (FOSSGIS) |
| Lugares a lo largo de la ruta | [Overpass API](https://overpass-api.de) |

Son servidores públicos con límites de uso justo. Si la app crece, conviene usar servidores propios o un proveedor de pago.

## Ejecutar en local

Es una web estática, sin compilación:

```sh
python3 -m http.server 8000
```

Abre http://localhost:8000. La ubicación solo funciona en `localhost` o con HTTPS.
