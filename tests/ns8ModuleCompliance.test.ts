import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = fs.existsSync(path.join(process.cwd(), "ns8"))
  ? process.cwd()
  : path.resolve(__dirname, "../..");
const NS8_DIR = path.join(REPO_ROOT, "ns8");
const IMAGEROOT_DIR = path.join(NS8_DIR, "imageroot");

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function flattenJsonKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenJsonKeys(v as Record<string, unknown>, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

test("NS8 Rule 1 & 2: get-status is never overridden and agent.dump_env() follows agent.set_env()", () => {
  assert.equal(
    fs.existsSync(path.join(IMAGEROOT_DIR, "actions", "get-status")),
    false,
    "imageroot/actions/get-status must NOT exist (conflicts with NS8 core get-status)"
  );

  const actionFiles = walkFiles(path.join(IMAGEROOT_DIR, "actions"));
  let setEnvScriptsCount = 0;
  for (const file of actionFiles) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("agent.set_env(")) {
      setEnvScriptsCount += 1;
      const lastSetEnv = content.lastIndexOf("agent.set_env(");
      const lastDumpEnv = content.lastIndexOf("agent.dump_env()");
      assert.ok(
        lastDumpEnv > lastSetEnv,
        `${path.relative(REPO_ROOT, file)} calls agent.set_env() without subsequent agent.dump_env()`
      );
    }
  }
  assert.ok(setEnvScriptsCount >= 5, "Expected >= 5 action scripts persisting module env");
});

test("NS8 Rule 3, 4, 5 & 6: Podman loopback binding, slirp4netns host loopback, --pull=missing, and health ordering", () => {
  const podUnit = fs.readFileSync(
    path.join(IMAGEROOT_DIR, "systemd", "user", "mdteam.service"),
    "utf8"
  );
  assert.match(podUnit, /127\.0\.0\.1:\$\{TCP_PORT\}:80/);
  assert.doesNotMatch(podUnit, /0\.0\.0\.0:\$\{TCP_PORT\}/);
  assert.match(podUnit, /allow_host_loopback=true/);
  assert.match(podUnit, /--add-host=accountprovider:10\.0\.2\.2/);

  const serviceDir = path.join(IMAGEROOT_DIR, "systemd", "user");
  const serviceFiles = fs.readdirSync(serviceDir).filter((f) => f.endsWith(".service"));
  assert.deepEqual(
    serviceFiles.sort(),
    ["mdteam-api.service", "mdteam-web.service", "mdteam-yjs.service", "mdteam.service"]
  );

  for (const unitName of serviceFiles) {
    const unitText = fs.readFileSync(path.join(serviceDir, unitName), "utf8");
    assert.doesNotMatch(unitText, /--pull=always/, `${unitName} must never use --pull=always`);
    if (unitName !== "mdteam.service") {
      assert.match(unitText, /--pull=missing/, `${unitName} must use --pull=missing`);
    }
  }

  const apiUnit = fs.readFileSync(path.join(serviceDir, "mdteam-api.service"), "utf8");
  assert.match(apiUnit, /ExecStartPost=.*\/api\/health/);

  const webUnit = fs.readFileSync(path.join(serviceDir, "mdteam-web.service"), "utf8");
  assert.match(webUnit, /After=.*mdteam-api\.service/);
  assert.match(webUnit, /After=.*mdteam-yjs\.service/);

  const hostnameCheck = fs.readFileSync(
    path.join(IMAGEROOT_DIR, "actions", "configure-module", "01hostname-validation"),
    "utf8"
  );
  assert.match(hostnameCheck, /agent\.http_route_in_use\(/);
  assert.match(hostnameCheck, /agent\.set_status\(["']validation-failed["']\)/);
  assert.match(hostnameCheck, /sys\.exit\(2\)/);
});

test("NS8 Rule 7 & 8: Backup/restore/clone scripts, Containerfile, GHCR workflow, and strict LF line endings", () => {
  const requiredRelPaths = [
    "etc/state-include.conf",
    "bin/module-dump-state",
    "bin/module-cleanup-state",
    "actions/restore-module/06copyenv",
    "actions/restore-module/50configure",
    "actions/clone-module/50configure",
    "update-module.d/20pull_images",
    "events/ldap-provider-changed/10reload_services",
  ];
  for (const rel of requiredRelPaths) {
    assert.ok(fs.existsSync(path.join(IMAGEROOT_DIR, rel)), `Missing ns8/imageroot/${rel}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
    version: string;
  };
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);

  const ns8RepoDir = path.join(REPO_ROOT, "ns8-repo");
  const allNs8Files = [...walkFiles(NS8_DIR), ...walkFiles(ns8RepoDir)];
  const imagerootFiles = walkFiles(IMAGEROOT_DIR);
  assert.ok(imagerootFiles.length >= 20);

  for (const file of allNs8Files) {
    if (/\.(png|ico)$/i.test(file)) continue;
    const raw = fs.readFileSync(file);
    assert.equal(
      raw.includes(0x0d),
      false,
      `CRLF (\\r) byte detected in ${path.relative(REPO_ROOT, file)} — strict LF required`
    );
    const text = raw.toString("utf8");
    assert.doesNotMatch(
      text,
      /:latest\b/,
      `Forbidden ':latest' tag detected in ${path.relative(REPO_ROOT, file)}`
    );
  }

  const containerfile = fs.readFileSync(path.join(NS8_DIR, "Containerfile"), "utf8");
  assert.match(containerfile, /npm install --legacy-peer-deps/);
  assert.match(containerfile, /--openssl-legacy-provider/);
  assert.match(containerfile, /sed -i 's\/\\r\$\/\/'/);
  assert.match(containerfile, /chmod \+x/);
  assert.match(containerfile, /FROM scratch/);
  assert.match(containerfile, new RegExp(`ARG APP_VERSION=${pkg.version.replace(/\./g, "\\.")}`));
  assert.match(containerfile, /ENTRYPOINT \["\/"\]/);
  assert.match(
    containerfile,
    /org\.nethserver\.authorizations="traefik@node:routeadm cluster:accountconsumer"/
  );
  assert.match(containerfile, /org\.nethserver\.tcp-ports-demand="1"/);
  assert.match(containerfile, /org\.nethserver\.rootfull="0"/);
  assert.match(containerfile, /ghcr\.io\/bls-isp\/mdteam\/workspace-web:\$\{APP_VERSION\}/);
  assert.match(containerfile, /ghcr\.io\/bls-isp\/mdteam\/api-server:\$\{APP_VERSION\}/);
  assert.match(containerfile, /ghcr\.io\/bls-isp\/mdteam\/yjs-server:\$\{APP_VERSION\}/);

  const dockerWorkflow = fs.readFileSync(
    path.join(REPO_ROOT, ".github", "workflows", "docker.yml"),
    "utf8"
  );
  assert.match(dockerWorkflow, /images:\s*ghcr\.io\/bls-isp\/mdteam\b/);
  assert.match(dockerWorkflow, /\.\/ns8\/Containerfile/);
  assert.doesNotMatch(dockerWorkflow, /value=latest/);

  const repodata = JSON.parse(
    fs.readFileSync(path.join(ns8RepoDir, "repodata.json"), "utf8")
  ) as Array<Record<string, unknown>>;
  assert.equal(repodata.length, 1);
  assert.equal(repodata[0].id, "mdteam");
  assert.equal(repodata[0].source, "ghcr.io/bls-isp/mdteam");
  assert.equal(repodata[0].logo, "logo.png");
  const logoBytes = fs.readFileSync(path.join(ns8RepoDir, "mdteam", "logo.png"));
  assert.deepEqual([...logoBytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const versions = repodata[0].versions as Array<{ tag: string; labels: Record<string, string> }>;
  assert.equal(versions[0].tag, pkg.version);
  assert.match(
    versions[0].labels["org.nethserver.images"],
    new RegExp(`ghcr\\.io/bls-isp/mdteam/workspace-web:${pkg.version.replace(/\./g, "\\.")}`)
  );
});

test("NS8 JSON schemas and Cockpit UI i18n EN/DE key parity + notification safety", () => {
  const schemaPaths = [
    path.join(IMAGEROOT_DIR, "actions", "configure-module", "validate-input.json"),
    path.join(IMAGEROOT_DIR, "actions", "get-configuration", "validate-input.json"),
    path.join(IMAGEROOT_DIR, "actions", "get-configuration", "validate-output.json"),
  ];
  for (const sp of schemaPaths) {
    const parsed = JSON.parse(fs.readFileSync(sp, "utf8")) as Record<string, unknown>;
    assert.match(String(parsed.$schema || ""), /json-schema\.org\/draft-07\/schema/);
    const schemaTypes = Array.isArray(parsed.type) ? parsed.type : [parsed.type];
    assert.ok(schemaTypes.includes("object"), `${sp} must allow JSON object type`);
  }

  const metadata = JSON.parse(
    fs.readFileSync(path.join(NS8_DIR, "ui", "public", "metadata.json"), "utf8")
  ) as Record<string, unknown>;
  assert.equal(metadata.name, "MDTeam Workspace");

  const enJson = JSON.parse(
    fs.readFileSync(path.join(NS8_DIR, "ui", "public", "i18n", "en", "translation.json"), "utf8")
  ) as Record<string, unknown>;
  const deJson = JSON.parse(
    fs.readFileSync(path.join(NS8_DIR, "ui", "public", "i18n", "de", "translation.json"), "utf8")
  ) as Record<string, unknown>;

  const enKeys = flattenJsonKeys(enJson);
  const deKeys = flattenJsonKeys(deJson);
  assert.deepEqual(deKeys, enKeys, "EN and DE NS8 Cockpit translation keys must match 1-to-1");

  for (const mandatoryKey of [
    "action.list-installed-modules",
    "task.cannot_create_task",
    "error.cannot_retrieve_installed_modules",
    "error.cannot_retrieve_module_info",
  ]) {
    assert.ok(enKeys.includes(mandatoryKey), `Missing mandatory NS8 i18n key: ${mandatoryKey}`);
  }

  const uiSrcFiles = walkFiles(path.join(NS8_DIR, "ui", "src"));
  for (const srcFile of uiSrcFiles) {
    if (/\.(png|ico)$/i.test(srcFile)) continue;
    const text = fs.readFileSync(srcFile, "utf8");
    assert.doesNotMatch(
      text,
      /createSuccessNotificationForApp/,
      `${path.relative(REPO_ROOT, srcFile)} must not call nonexistent createSuccessNotificationForApp`
    );
  }

  const mainJs = fs.readFileSync(path.join(NS8_DIR, "ui", "src", "main.js"), "utf8");
  assert.match(mainJs, /loadLanguage\(["']en["']\)/);
  assert.match(mainJs, /fallbackLocale:\s*["']en["']/);
});
