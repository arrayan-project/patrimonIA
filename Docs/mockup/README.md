# Mockup de diseño (estático)

`index.html` es una maqueta **independiente de la app** para iterar el diseño
sin tocar Expo/React Native. Ábrelo con doble clic en el navegador.

## Qué trae

- **Tokens** de color / tipografía / espaciado calcados de `app/src/ui/tema.ts`
  y `app/src/ui/index.tsx` (bloques `:root` y `:root[data-theme="dark"]` en el `<style>`).
- Selector de **tema** (Auto / Claro / Oscuro) arriba a la derecha.
- **17 pantallas** navegables desde la barra lateral, dentro de un marco de teléfono:
  Login, las 5 pestañas (Inicio, Movimientos, Planificar, Hogar, Config) y las
  pantallas de detalle/formulario más representativas.
- Página **Sistema de diseño**: swatches del tema activo + galería de todos los
  componentes (`Button`, `Field`, `Select`, `Segmented`, `Card`, `ListItem`,
  `Row`, `Stat`, `ProgressBar`, `Chip`, `Ayuda`, `EmptyState`, `MenuLink`,
  dona / línea / barras).

## Cómo iterar

1. Edita `index.html` (colores en los `--tokens`, o el markup/CSS de una pantalla).
2. Recarga el navegador para ver el cambio.
3. Cuéntame qué probaste y lo aplico a la app real (`app/src/ui/` y las screens).

> Los datos son **mockup** (escenario "Casa Riquelme"). Los iconos son siluetas
> aproximadas — en la app son `@expo/vector-icons` (Ionicons).
