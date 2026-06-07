import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".codex-home/**",
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "data/**",
      "prisma/dev.db",
    ],
  },
];

export default eslintConfig;
