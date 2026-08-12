---
"@platform/create-app": patch
---

New package: `@platform/create-app` — scaffolds a new project following
`platform/SKILL.md` § Estructura de carpetas, and vendors the needed `@platform/*`
packages into the generated project's own pnpm workspace (`workspace:*`, built in dependency
order via `postinstall`). This is the installation path that actually resolves end to end today —
see the corrected `SKILL.md` § Instalación: referencing a package with internal `@platform/*`
dependencies via `file:` from outside a pnpm workspace does not work until these packages are
published to a real registry (`workspace:*` is only rewritten at publish time).
