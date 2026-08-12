# platform (skill)

Skill de Claude Code / agentes que documenta la arquitectura hexagonal + DDD recomendada para
aplicaciones construidas sobre `@platform/{core,infrastructure,env,adapter-aws,adapter-node}`.

No es un paquete npm: es contenido de skill, pensado para copiarse junto con los paquetes de la
librería a un proyecto consumidor. [`SKILL.md`](./SKILL.md) es el índice (filosofía, instalación, y
qué archivo leer para cada pregunta); el detalle de cada tema vive en `references/*.md` — cargar
solo el archivo relevante a la tarea en curso, no todo el contrato de una vez.

## Cómo instalarla en otro proyecto

Este repo aún no publica nada a un registro. Para usar esta skill en otro proyecto:

1. Clona `platform`.
2. Copia esta carpeta completa (`packages/skills/platform`) dentro del proyecto consumidor, en
   `.claude/skills/platform/` o `.agents/skills/platform/` (según qué herramienta de
   agentes use ese proyecto).
3. Copia también los paquetes de librería que necesites (`packages/core`, `packages/infrastructure`,
   `packages/env`, `packages/adapters/aws` y/o `packages/adapters/node`) — ver la sección "Instalación"
   dentro de [SKILL.md](./SKILL.md) para cómo referenciarlos desde `package.json`.

La skill y la librería se versionan juntas en este repo a propósito: si cambia la forma de consumir los
paquetes (nombres, exports), la skill debe actualizarse en el mismo cambio.
