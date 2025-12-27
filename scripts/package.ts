/**
 * パッケージングスクリプト
 * dist フォルダを ZIP ファイルにパッケージング
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zip } from "zip-a-folder";

async function main() {
  const distDir = join(import.meta.dir, "..", "dist");
  const packageJson = JSON.parse(
    readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8"),
  );
  const version = packageJson.version;
  const outputPath = join(import.meta.dir, "..", `pastehost-${version}.zip`);

  console.log(`Packaging dist/ to ${outputPath}...`);

  await zip(distDir, outputPath);

  console.log(`Done! Created ${outputPath}`);
}

main().catch((error) => {
  console.error("Packaging failed:", error);
  process.exit(1);
});
