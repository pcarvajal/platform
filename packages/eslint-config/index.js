import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

// Mapea 1:1 la estructura de carpetas y la dirección de dependencias de
// company-platform/SKILL.md ("Estructura de carpetas" / "Dirección de dependencias").
const ELEMENT_TYPES = [
  { type: "domain", pattern: "src/core/domain/**" },
  { type: "application", pattern: "src/core/application/**" },
  { type: "infrastructure", pattern: "src/infrastructure/**" },
  { type: "apps", pattern: "src/apps/**" },
  { type: "shared", pattern: "src/shared/**" },
];

const platformErrorSelector = "[superClass.name=/^(PlatformError|AdapterError)$/]";
const noExtendPlatformError = {
  selector: `ClassDeclaration${platformErrorSelector}, ClassExpression${platformErrorSelector}`,
  message:
    "No extiendas PlatformError/AdapterError desde el código del proyecto: esa rama es exclusiva " +
    "de @platform/* (SKILL.md § Jerarquía de errores). Extiende ApplicationError, DomainError o " +
    "HttpError en su lugar.",
};

const noProcessEnv = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message:
    "process.env solo puede leerse en infrastructure/env.ts (SKILL.md § infrastructure/env.ts). " +
    "El resto del código recibe configuración ya parseada por inyección manual.",
};

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.turbo/**", "**/node_modules/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": ELEMENT_TYPES,
      // SKILL.md usa imports relativos con sufijo .js (NodeNext) que apuntan a fuentes .ts —
      // el resolver por defecto de eslint-plugin-boundaries no reescribe esa extensión.
      "import/resolver": {
        typescript: true,
      },
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // SKILL.md § Dirección de dependencias: "las flechas solo van hacia el núcleo" —
      // deployment → apps → application → domain.
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message:
            "${file.type} no puede importar de ${dependency.type} (ver SKILL.md § Dirección de dependencias).",
          rules: [
            { from: "domain", allow: [] },
            { from: "application", allow: ["domain"] },
            { from: "apps", allow: ["application", "domain", "shared"] },
            {
              from: "infrastructure",
              allow: ["apps", "application", "domain", "shared", "infrastructure"],
            },
            { from: "shared", allow: [] },
          ],
        },
      ],

      "no-restricted-syntax": ["error", noExtendPlatformError, noProcessEnv],
    },
  },
  {
    // Único punto autorizado a leer process.env (SKILL.md § infrastructure/env.ts).
    files: ["**/infrastructure/env.ts"],
    rules: {
      "no-restricted-syntax": ["error", noExtendPlatformError],
    },
  },
  eslintConfigPrettier,
);
