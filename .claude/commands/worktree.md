---
description: Crea un git worktree aislado y ejecuta en él las instrucciones recibidas, sin afectar el código principal
argument-hint: <descripción del requerimiento o instrucciones a ejecutar>
---

## Contexto

El usuario quiere que implementes el siguiente requerimiento dentro de un git worktree completamente aislado del árbol de trabajo principal, para no afectar la rama actual ni los archivos que ya están ahí.

Requerimiento / instrucciones a ejecutar:
$ARGUMENTS

## Pasos a seguir

1. **Determina un nombre corto** en kebab-case (minúsculas, palabras separadas por guiones, sin acentos ni espacios) que describa el requerimiento anterior. Este será `[nombre]`. Si `.trees/[nombre]` ya existe, elige un nombre alternativo (por ejemplo con sufijo numérico) en lugar de sobreescribir.

2. **Verifica el estado del repo** con `git status` antes de crear el worktree, para confirmar que no hay cambios sin commitear en la rama actual que puedan generar confusión.

3. **Crea el worktree** desde la raíz del repo:
   ```
   git worktree add .trees/[nombre]
   ```
   Esto crea una nueva rama `[nombre]` basada en `HEAD` y un directorio de trabajo independiente en `.trees/[nombre]`, sin tocar el árbol de trabajo principal ni la rama en la que estabas.

   Si `.trees/` no está listado en `.gitignore`, agrégalo (una línea `.trees/`) para evitar cualquier ambigüedad sobre archivos no rastreados en el repo principal.

4. **Trabaja exclusivamente dentro de `.trees/[nombre]`** para el resto de la tarea: lee, edita y crea archivos únicamente bajo esa ruta. No modifiques nada fuera de `.trees/[nombre]` bajo ninguna circunstancia — esa es la garantía de aislamiento del comando.

5. **Ejecuta el requerimiento recibido** dentro de ese worktree: implementa el cambio, corrige el bug o realiza la tarea solicitada como lo harías normalmente, pero con todas las rutas relativas a `.trees/[nombre]`.

6. **No hagas commit, push ni merge automáticamente**, a menos que el usuario lo haya pedido explícitamente como parte del requerimiento. Al terminar, informa de forma breve:
   - La ruta del worktree y el nombre de la rama creada.
   - Un resumen de los cambios realizados.
   - Cómo revisar los cambios (`git -C .trees/[nombre] diff`) o integrarlos cuando esté listo (`git merge [nombre]` desde la rama principal).
   - Cómo eliminar el worktree cuando ya no se necesite: `git worktree remove .trees/[nombre]`.

## Notas

- Cada invocación de `/worktree` debe generar un worktree nuevo con un nombre distinto basado en el requerimiento recibido; no reutilices worktrees de invocaciones anteriores a menos que el usuario lo pida explícitamente.
- El objetivo es que el trabajo se pueda descartar sin riesgo (`git worktree remove`) si el usuario decide no integrarlo.
