import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
const version = String(pkg.version || "").trim();

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version) || version === "latest") {
  throw new Error(`Invalid SemVer version in package.json: "${version}" (:latest is forbidden)`);
}

const uiMetadataPath = path.join(REPO_ROOT, "ns8", "ui", "public", "metadata.json");
const uiMetadata = JSON.parse(fs.readFileSync(uiMetadataPath, "utf8"));

const repoDir = path.join(REPO_ROOT, "ns8-repo");
const moduleDir = path.join(repoDir, "mdteam");
fs.mkdirSync(moduleDir, { recursive: true });

const iconSrc = path.join(REPO_ROOT, "src-tauri", "icons", "128x128.png");
const logoDest = path.join(moduleDir, "logo.png");
fs.copyFileSync(iconSrc, logoDest);

const moduleMetadata = {
  name: uiMetadata.name,
  description: uiMetadata.description,
  categories: uiMetadata.categories,
  authors: uiMetadata.authors,
  docs: uiMetadata.docs,
  source: "ghcr.io/bls-isp/mdteam",
};

fs.writeFileSync(
  path.join(moduleDir, "metadata.json"),
  `${JSON.stringify(moduleMetadata, null, 2).replace(/\r\n/g, "\n")}\n`,
  "utf8"
);

const isPrerelease = version.includes("-");
const repodata = [
  {
    id: "mdteam",
    name: moduleMetadata.name,
    description: moduleMetadata.description,
    logo: "logo.png",
    screenshots: [],
    categories: moduleMetadata.categories,
    authors: moduleMetadata.authors,
    docs: moduleMetadata.docs,
    source: moduleMetadata.source,
    versions: [
      {
        tag: version,
        testing: isPrerelease,
        labels: {
          "org.opencontainers.image.source": "https://github.com/BLS-ISP/MDTeam",
          "org.nethserver.authorizations": "traefik@node:routeadm cluster:accountconsumer",
          "org.nethserver.flags": "",
          "org.nethserver.images": [
            `ghcr.io/bls-isp/mdteam/workspace-web:${version}`,
            `ghcr.io/bls-isp/mdteam/api-server:${version}`,
            `ghcr.io/bls-isp/mdteam/yjs-server:${version}`,
          ].join(" "),
          "org.nethserver.max-per-node": "5",
          "org.nethserver.min-core": "3.0.0",
          "org.nethserver.rootfull": "0",
          "org.nethserver.tcp-ports-demand": "1",
        },
      },
    ],
  },
];

fs.writeFileSync(
  path.join(repoDir, "repodata.json"),
  `${JSON.stringify(repodata, null, 2).replace(/\r\n/g, "\n")}\n`,
  "utf8"
);

function normalizeLf(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      normalizeLf(full);
    } else if (entry.isFile() && !/\.(png|ico)$/i.test(full)) {
      const buf = fs.readFileSync(full);
      if (buf.includes(0x0d)) {
        fs.writeFileSync(full, buf.toString("utf8").replace(/\r\n?/g, "\n"), "utf8");
      }
    }
  }
}

normalizeLf(path.join(REPO_ROOT, "ns8"));
normalizeLf(repoDir);

console.log(`Generated ns8-repo/repodata.json for ghcr.io/bls-isp/mdteam:${version}`);
