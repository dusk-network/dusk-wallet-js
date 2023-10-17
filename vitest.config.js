/* eslint-disable import/no-unresolved */

import { defineConfig } from "vitest/config";

/* eslint-enable import/no-unresolved */

export default defineConfig({
	test: {
		coverage: {
			"100": true,
			"all": true,
			"exclude": [
				"*.*",
				"**/{*.,}typedefs.js",
				"**/*.d.ts",
				"**/coverage",
				"**/docs"
			]
		},
		environment: "node"
	}
});
