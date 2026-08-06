# company-platform (skill)

Skill de Claude Code / agentes que documenta la arquitectura hexagonal + DDD recomendada para
aplicaciones construidas sobre `@platform/{core,infrastructure,env,adapter-aws,adapter-node}`.

No es un paquete npm: es contenido de skill, pensado para copiarse junto con los paquetes de la
librería a un proyecto consumidor.

## Cómo instalarla en otro proyecto

Este repo aún no publica nada a un registro. Para usar esta skill en otro proyecto:

1. Clona `platform`.
2. Copia esta carpeta completa (`packages/skills/company-platform`) dentro del proyecto consumidor, en
   `.claude/skills/company-platform/` o `.agents/skills/company-platform/` (según qué herramienta de
   agentes use ese proyecto).
3. Copia también los paquetes de librería que necesites (`packages/core`, `packages/infrastructure`,
   `packages/env`, `packages/adapters/aws` y/o `packages/adapters/node`) — ver la sección "Instalación"
   dentro de [SKILL.md](./SKILL.md) para cómo referenciarlos desde `package.json`.

La skill y la librería se versionan juntas en este repo a propósito: si cambia la forma de consumir los
paquetes (nombres, exports), la skill debe actualizarse en el mismo cambio.
