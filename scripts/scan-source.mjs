// Reproduces the n8n verification scanner's ESLint pass against the working
// tree, so violations fail CI and the publish instead of the post-release
// review. This is NOT the same as `npm run lint`: the scanner builds its own
// flat config and runs ESLint with `allowInlineConfig: false`, so rules it
// enforces cannot be suppressed with eslint-disable comments and `npm run
// lint` can stay green while the scanner fails (this is exactly what burned
// the 0.9.2 review - see PUBLISHING.md).
import { fileURLToPath } from 'node:url';
import { analyzePackage, SOURCE_FILE_PATTERNS } from '@n8n/scan-community-package/scanner/scanner.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const result = await analyzePackage(packageDir, SOURCE_FILE_PATTERNS);

if (!result.passed) {
	console.error(result.message);
	if (result.details) console.error(result.details);
	process.exit(1);
}

console.log('✓ Scanner ESLint pass: 0 errors');
