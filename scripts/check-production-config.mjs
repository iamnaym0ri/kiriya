import { env } from "../server/env.js";
import { productionConfigurationIssues } from "../server/configuration.js";

const issues = productionConfigurationIssues(env);
if (issues.length) {
  console.error("Production configuration needs attention:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    "✓ Required production configuration is valid; optional integrations are not required.",
  );
}
