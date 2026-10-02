import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const FILES = [...sourceFiles(path.join(ROOT, "src")), ...sourceFiles(path.join(ROOT, "app"))];

/**
 * Screens registered as href:null tabs in app/(app)/_layout.tsx. A direct
 * push to one is a cross-tab switch with nothing behind it for back to
 * return to. Links must go through src/utils/originLink, which stamps the
 * origin on the route. Matched as a quoted path in any spelling -- object
 * pathname, template string, concatenation, with or without the (app) group.
 */
const ORIGIN_ROUTES: Record<string, RegExp> = {
  "/(app)/users/[id]": /["'`](?:\/\(app\))?\/users\/(?:\[id\]|\$\{|["'`])/,
  "/(app)/projects/[id]/preview":
    /(?:["'`](?:\/\(app\))?\/projects\/(?:\[id\]|\$\{[^}]*\})\/preview|["'`]\/preview["'`])/,
};

const ALLOWED: Record<string, string> = {
  "src/utils/originLink.ts": "it is the helper",
  // Replaces the create form with the new project's preview. Both screens
  // are already inside the projects stack, so an ordinary back is correct.
  "src/features/projects/CreateProject.tsx": "same-stack replace",
};

test.each(Object.entries(ORIGIN_ROUTES))("nothing navigates to %s except through originLink", (_route, pattern) => {
  const offenders = FILES.map((f) => path.relative(ROOT, f)).filter(
    (rel) => !(rel in ALLOWED) && pattern.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))
  );
  expect(offenders).toEqual([]);
});
