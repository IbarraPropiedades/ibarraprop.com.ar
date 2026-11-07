# Ibarra Propiedades

Sitio de [Ibarra Propiedades](https://ibarraprop.com.ar), publicado con GitHub Pages desde la rama `gh-pages`.

## Cómo se actualizan las propiedades

Las propiedades se cargan en Tokko Broker. El workflow
[actualizar-propiedades.yml](.github/workflows/actualizar-propiedades.yml) corre cada 3 horas,
ejecuta `scripts/build-propiedades.mjs` y publica los cambios.

También se puede lanzar a mano desde la pestaña **Actions** o, en local:

```sh
TOKKO_API_KEY=xxxx node scripts/build-propiedades.mjs
```

Requiere Node 22 y el secret `TOKKO_API_KEY` en el repositorio. La clave nunca debe ir en el código.

## Qué genera el script

No editar a mano, porque se sobrescribe:

- `propiedades/<slug>/`: una página por propiedad.
- `zonas/<slug>/`: páginas de zonas con 3 propiedades o más.
- `data/propiedades.json`: datos del listado, sin direcciones reales ni datos internos.
- `sitemap.xml`.
- Los bloques `<!-- GEN:nombre -->` de las páginas fijas: menú, pie, formulario de tasación,
  buscador, vitrina, datos y zonas.

Para cambiar el menú, el pie o el formulario, editar el script y volver a generar.
