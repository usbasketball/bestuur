import { pathToFileURL } from "url";

// True when the calling module was executed directly (`tsx scripts/sync-*.ts`)
// rather than imported. ESM equivalent of Node's `require.main === module`.
// Pass the calling module's own `import.meta.url`:
//
//   if (isMainModule(import.meta.url)) {
//     void main();
//   }
export function isMainModule(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;
  return moduleUrl === pathToFileURL(process.argv[1]).href;
}