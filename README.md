# figma-tokens · Design tokens

Plugin para administrar variables locales de diseño con valores de día y noche en una ventana flotante. El plan gratuito puede usar este enfoque: se modifica el valor de un solo modo por variable, sin crear modos nativos adicionales.

## Instalación

Node.js 22 o superior. Ejecuta `npm ci` y `npm run check`. Importa `manifest.json` de la raíz desde **Plugins → Development → Import new plugin from manifest…** en Figma desktop. Reimporta el manifiesto después de actualizar versiones que cambien su configuración.

## Uso

Abre **figma-tokens → Editar tokens**:

### Acceso por teclado

Después de ejecutar **Editar tokens**, puedes volver a abrirlo con **⌘⌥P** en Mac o **Ctrl+Alt+P** en Windows. Es el atajo de Figma para ejecutar el último plugin/comando usado: si ejecutas otro plugin o Modo día/noche, repetirá esa acción. Para elegir el editor explícitamente, usa el menú de acciones de Figma y busca **Editar tokens**.

Figma no permite registrar un atajo global propio desde el manifiesto de un plugin. [Atajos oficiales para plugins](https://help.figma.com/hc/en-us/articles/360042532714-Use-plugins-in-files).


- **Día / Noche** cambia todos los colores vinculados del archivo.
- **×** elimina el color y su variable local. Puede afectar los elementos vinculados a esa variable; puedes deshacer desde Figma.
- Selecciona una categoría y pulsa **+** para agregar un token. Todos permiten renombrar, editar día/noche y borrar.

| Categoría | Variable | Valor inicial | Uso |
| --- | --- | --- | --- |
| Colors | COLOR | blanco / casi negro | Fill, Stroke y texto |
| Font size | FLOAT | 16 / 16 px | Tamaño de texto |
| Font weight | FLOAT | 400 / 400 | Peso tipográfico |
| Letter spacing | FLOAT | 0 / 0 px | Espaciado entre letras |
| Height / Width | FLOAT | 36 / 36 px | Alto y ancho |
| Border radius | FLOAT | 8 / 8 px | Radio de esquinas |

Los tokens numéricos aparecen en el selector de variables de la propiedad correspondiente, gracias a su scope. El peso efectivo depende de los pesos que soporte la fuente utilizada. Font size debe ser positivo, border radius no negativo y font weight entre 1 y 1000. Letter spacing admite valores negativos. Día y noche pueden tener el mismo valor.

- Edita el nombre en la ventana; se sincroniza inmediatamente manteniendo el identificador y los vínculos. Los nombres deben ser únicos y no vacíos.
- La muestra es únicamente una vista previa; no abre un selector ni un cuentagotas. Edita el código hexadecimal de día o noche directamente en la fila.


Asigna las variables desde el selector de variables de **Fill**, dentro de la colección local **figma-tokens**. No son una biblioteca publicada. `bg` viene creado y se conservan los colores y las variables de las versiones anteriores. Los nombres y ambos colores se guardan como datos del plugin en el archivo. No se crean ni se necesitan muestras, frames o etiquetas del canvas. Puedes eliminar el área antigua. La primera ejecución migra las variables existentes y conserva sus identificadores; si las muestras antiguas ya no existen, recupera el valor activo desde la variable y usa blanco/casi negro para el modo que no se pueda recuperar. Revisa esos valores en la ventana.

Los comandos **Modo día** y **Modo noche** también siguen disponibles desde el menú. El tema es global: no mantiene frames en temas distintos simultáneamente.

## Desarrollo y validación

`npm run build` comprueba tipos y compila `src/code.ts` a `dist/code.js`. `npm run watch` observa los cambios de TypeScript; vuelve a ejecutar el plugin tras editar. La UI se lee directamente desde `src/ui.html`. `npm run check` también valida las rutas del manifiesto. Mantén estable el identificador local del plugin para recuperar datos; antes de publicar usa el oficial asignado por Figma.

La compilación se verifica localmente. La interacción visual debe validarse dentro de Figma.

## Fuentes

- [Plugins de desarrollo](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development)
- [UI de plugins](https://developers.figma.com/docs/plugins/creating-ui/)
- [Cuentagotas nativo de Figma](https://help.figma.com/hc/en-us/articles/27643269375767-Sample-colors-with-the-eyedropper-tool)
- [API web EyeDropper](https://developer.chrome.com/docs/capabilities/web-apis/eyedropper)

[Scopes y propiedades numéricas admitidas](https://developers.figma.com/docs/plugins/api/VariableScope/) · [Vinculación de variables a texto](https://developers.figma.com/docs/plugins/working-with-variables/)

## Tamaño de la ventana

Arrastra la esquina inferior derecha para redimensionar el panel. También puedes enfocar ese control y usar las flechas. El tamaño se recuerda en el archivo (mínimo 340 × 240, máximo 1000 × 1000). La lista tiene scroll independiente al crecer.

`npm test` comprueba migración de colores, categorías y scopes numéricos, cambio día/noche, nombres, validación, borrado y redimensionado con una API simulada.

## Defaults de shadcn

El panel precarga **145 presets** una sola vez por archivo: 31 colores, 13 tamaños de texto, 9 pesos, 6 espaciados, 8 radios, 8 sombras, 35 alturas y 35 anchos. Se usa un único catálogo con nombres sin prefijos: `background`, `text-sm`, `font-medium`, `tracking-wide`, `radius-sm` y `shadow-2xl`.

- Los colores son una **adaptación monocromática del tema Neutral de shadcn**: se conserva la luminosidad y el alpha, y se elimina el chroma de destructive/charts. La paleta completa de Tailwind no se precarga.
- La tipografía procede de las escalas Tailwind 4.3.3 heredadas por shadcn. Los valores rem se convierten con base de 16 px. Tracking está convertido desde em a px para texto de 16 px: ajusta proporcionalmente si usas otro tamaño.
- Height y Width usan la escala fija de Tailwind: `h-px`/`w-px` (1 px) y pasos de `0` a `96`, incluyendo medios pasos hasta `3.5`. Figma no acepta puntos en nombres de variables: `h-0_5`/`w-0_5` equivalen a las clases `h-0.5`/`w-0.5`; la exportación conserva la clase original en `preset`. Cada unidad equivale a 4 px: `h-6` = 24, `h-8` = 32, `h-9` = 36 y `h-10` = 40 px. Se agregan automáticamente a archivos existentes conservando los tokens anteriores. Valores relativos como `full`, `auto` y fracciones no tienen una equivalencia fija en px y se configuran con el layout de Figma.
- Radius usa el valor base de shadcn de 10 px y sus multiplicadores oficiales. Los valores derivados son snapshots editables, no aliases dinámicos.
- Shadows usa la escala de box-shadow de Tailwind que emplea shadcn: none, 2xs, xs, sm, md, lg, xl y 2xl. Se guarda en **estilos de efectos locales**, disponibles en el selector de estilos de **Effects**, no en las variables de Fill. Su valor admite `none` o capas `X Y blur spread #RRGGBBAA` separadas por comas. Los presets tienen igual valor en día y noche; puedes editarlos por separado.

Puedes borrar presets: **no reaparecen al abrir el plugin**. **Regenerar** restaura únicamente la categoría seleccionada, recupera defaults borrados y actualiza los existentes conservando su identificador. Restablece nombres y valores de los presets de esa categoría; conserva tokens personalizados. Si un nombre está ocupado por un token personalizado, el preset recibe un sufijo para evitar conflictos.

La migración elimina los prefijos de los nombres estándar sin cambiar sus identificadores. El catálogo anterior separado de radios Tailwind se retira del panel; sus variables existentes se conservan para no romper elementos vinculados.

## Copiar para implementar el theme

**Copiar** exporta todas las categorías, independientemente del filtro o la sección visible, como JSON con nombres, valores de día/noche y notas de unidades. Puedes pegarlo en un modelo de lenguaje para pedir la implementación del theme. Si el entorno bloquea el portapapeles, aparece el texto seleccionado para copiarlo manualmente con Cmd/Ctrl + C. Los colores admiten `#RRGGBB` y `#RRGGBBAA` para conservar transparencia.

El catálogo se genera con `npm run generate:presets` desde el paquete Tailwind fijado por el lockfile y el snapshot oficial de shadcn en `presets/shadcn-neutral.css`. No requiere red al ejecutar el plugin.

Fuentes: [shadcn theming](https://ui.shadcn.com/docs/theming), [Tailwind theme](https://tailwindcss.com/docs/theme), [box-shadow](https://tailwindcss.com/docs/box-shadow), [estilos de efectos de Figma](https://developers.figma.com/docs/plugins/api/EffectStyle/).

## Open source

Repositorio: https://github.com/rawars/figma-tokens. Licencia MIT, véase `LICENSE`. Para contribuir, ejecuta `npm ci` y `npm test` antes de abrir un pull request.

El identificador del manifiesto y las claves internas históricas se conservan para mantener los datos y vínculos de versiones anteriores. Las colecciones existentes conservan su nombre; las nuevas se llaman `figma-tokens`.
