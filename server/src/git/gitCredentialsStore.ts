import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDataDir, HttpError } from "../httpHelpers.js";
import type {
  AuthUser,
  GitAuthType,
  ProjectVisibility,
  PublicProjectSummary,
} from "../types.js";

export interface StoredProjectRecord {
  projectId: string;
  displayName: string;
  remoteUrl: string;
  authType: GitAuthType;
  httpsUsername: string;
  encryptedToken: string;
  encryptedSshPrivateKey: string;
  sshPublicKey: string;
  defaultBranch: string;
  visibility: ProjectVisibility;
  ownerId: string;
  ownerHandle: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectsStoreFile {
  version: number;
  projects: Record<string, StoredProjectRecord>;
}

function getProjectsStorePath(): string {
  return path.join(getDataDir(), "git-projects.json");
}

function deriveAesKey(): Buffer {
  const rawSecret =
    process.env.MDTEAM_GIT_CREDENTIALS_KEY ||
    process.env.JWT_SECRET ||
    process.env.MDTEAM_JWT_SECRET ||
    "mdteam-dev-fallback-jwt-secret-key-change-in-prod";
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(rawSecret, "utf8"),
      Buffer.from("mdteam-git-credentials-salt-v1", "utf8"),
      Buffer.from("aes-256-gcm", "utf8"),
      32
    )
  );
}

export function encryptGitSecret(plainText: string): string {
  if (!plainText) return "";
  const key = deriveAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptGitSecret(payload: string): string {
  if (!payload || !payload.startsWith("v1:")) return "";
  const parts = payload.split(":");
  if (parts.length !== 4) return "";
  try {
    const key = deriveAesKey();
    const iv = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    const data = Buffer.from(parts[3], "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function sshWireString(buf: Buffer | string): Buffer {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  const len = Buffer.alloc(4);
  len.writeUInt32BE(b.length, 0);
  return Buffer.concat([len, b]);
}

export function generateEd25519OpenSshKeyPair(comment: string): {
  publicKey: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const spkiDer = publicKey.export({ type: "spki", format: "der" });
  const pkcs8Der = privateKey.export({ type: "pkcs8", format: "der" });
  const pubRaw = spkiDer.subarray(spkiDer.length - 32);
  const seedRaw = pkcs8Der.subarray(pkcs8Der.length - 32);

  const keyType = "ssh-ed25519";
  const pubBlob = Buffer.concat([sshWireString(keyType), sshWireString(pubRaw)]);
  const publicKeyLine = `${keyType} ${pubBlob.toString("base64")} ${comment}`;

  const checkInt = crypto.randomBytes(4);
  const priv64 = Buffer.concat([seedRaw, pubRaw]);
  let privPayload = Buffer.concat([
    checkInt,
    checkInt,
    sshWireString(keyType),
    sshWireString(pubRaw),
    sshWireString(priv64),
    sshWireString(comment),
  ]);
  const padNeeded = (8 - (privPayload.length % 8)) % 8;
  if (padNeeded > 0) {
    const pad = Buffer.alloc(padNeeded);
    for (let i = 0; i < padNeeded; i += 1) pad[i] = i + 1;
    privPayload = Buffer.concat([privPayload, pad]);
  }

  const numKeys = Buffer.alloc(4);
  numKeys.writeUInt32BE(1, 0);
  const opensshBin = Buffer.concat([
    Buffer.from("openssh-key-v1\0", "utf8"),
    sshWireString("none"),
    sshWireString("none"),
    sshWireString(""),
    numKeys,
    sshWireString(pubBlob),
    sshWireString(privPayload),
  ]);
  const b64Lines = (opensshBin.toString("base64").match(/.{1,70}/g) || []).join("\n");
  const privateKeyPem = `-----BEGIN OPENSSH PRIVATE KEY-----\n${b64Lines}\n-----END OPENSSH PRIVATE KEY-----\n`;
  return { publicKey: publicKeyLine, privateKeyPem };
}

export function extractEmbeddedUrlCredentials(rawUrl: string): {
  cleanUrl: string;
  extractedUser: string;
  extractedToken: string;
} {
  const trimmed = (rawUrl || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { cleanUrl: trimmed, extractedUser: "", extractedToken: "" };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, "Malformed HTTP(S) Git repository URL", "INVALID_REMOTE_URL");
  }
  const rawUser = decodeURIComponent(parsed.username || "");
  const rawPass = decodeURIComponent(parsed.password || "");
  parsed.username = "";
  parsed.password = "";
  const cleanUrl = parsed.toString();

  if (rawUser && rawPass) {
    return { cleanUrl, extractedUser: rawUser, extractedToken: rawPass };
  }
  if (rawUser && !rawPass) {
    return { cleanUrl, extractedUser: "x-access-token", extractedToken: rawUser };
  }
  return { cleanUrl, extractedUser: "", extractedToken: "" };
}

async function readProjectsStore(): Promise<ProjectsStoreFile> {
  try {
    const raw = await fs.readFile(getProjectsStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectsStoreFile>;
    if (parsed && parsed.projects && typeof parsed.projects === "object") {
      return { version: 1, projects: parsed.projects };
    }
  } catch {
    // Initialize empty store on first write
  }
  return { version: 1, projects: {} };
}

async function writeProjectsStore(store: ProjectsStoreFile): Promise<void> {
  const target = getProjectsStorePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.chmod(target, 0o600).catch(() => undefined);
}

export function toPublicProjectSummary(rec: StoredProjectRecord): PublicProjectSummary {
  return {
    projectId: rec.projectId,
    displayName: rec.displayName || rec.projectId,
    remoteUrl: rec.remoteUrl || "",
    authType: rec.authType || "none",
    httpsUsername: rec.httpsUsername || "",
    hasToken: Boolean(rec.encryptedToken),
    hasSshKey: Boolean(rec.encryptedSshPrivateKey),
    sshPublicKey: rec.sshPublicKey || "",
    defaultBranch: rec.defaultBranch || "main",
    visibility: rec.visibility || "team",
    ownerId: rec.ownerId || "",
    ownerHandle: rec.ownerHandle || "",
    createdAt: rec.createdAt,
  };
}

export async function getStoredProjectRecord(
  projectId: string
): Promise<StoredProjectRecord | null> {
  const store = await readProjectsStore();
  return store.projects[projectId] || null;
}

export async function listStoredProjectRecords(): Promise<Record<string, StoredProjectRecord>> {
  const store = await readProjectsStore();
  return store.projects;
}

export async function upsertStoredProjectRecord(
  projectId: string,
  patch: Partial<Omit<StoredProjectRecord, "projectId" | "encryptedToken" | "encryptedSshPrivateKey">> & {
    httpsToken?: string;
    sshPrivateKey?: string;
    clearToken?: boolean;
  },
  actor?: AuthUser
): Promise<StoredProjectRecord> {
  const store = await readProjectsStore();
  const now = new Date().toISOString();
  const prev = store.projects[projectId];

  let nextEncToken = prev?.encryptedToken || "";
  if (patch.clearToken) nextEncToken = "";
  else if (typeof patch.httpsToken === "string" && patch.httpsToken.trim()) {
    nextEncToken = encryptGitSecret(patch.httpsToken.trim());
  }

  let nextEncSsh = prev?.encryptedSshPrivateKey || "";
  if (typeof patch.sshPrivateKey === "string" && patch.sshPrivateKey.trim()) {
    nextEncSsh = encryptGitSecret(patch.sshPrivateKey);
  }

  const next: StoredProjectRecord = {
    projectId,
    displayName: patch.displayName ?? prev?.displayName ?? projectId,
    remoteUrl: patch.remoteUrl ?? prev?.remoteUrl ?? "",
    authType: patch.authType ?? prev?.authType ?? "none",
    httpsUsername: patch.httpsUsername ?? prev?.httpsUsername ?? "",
    encryptedToken: nextEncToken,
    encryptedSshPrivateKey: nextEncSsh,
    sshPublicKey: patch.sshPublicKey ?? prev?.sshPublicKey ?? "",
    defaultBranch: patch.defaultBranch ?? prev?.defaultBranch ?? "main",
    visibility: patch.visibility ?? prev?.visibility ?? "team",
    ownerId: prev?.ownerId || patch.ownerId || actor?.id || "",
    ownerHandle: prev?.ownerHandle || patch.ownerHandle || actor?.handle || actor?.username || "",
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };

  store.projects[projectId] = next;
  await writeProjectsStore(store);
  return next;
}

export async function removeStoredProjectRecord(projectId: string): Promise<void> {
  const store = await readProjectsStore();
  if (store.projects[projectId]) {
    delete store.projects[projectId];
    await writeProjectsStore(store);
  }
}

export function canUserAccessProject(
  record: StoredProjectRecord | null,
  user: AuthUser
): boolean {
  if (!record || record.visibility !== "private") return true;
  return user.role === "admin" || (Boolean(record.ownerId) && record.ownerId === user.id);
}

export async function assertProjectAccess(projectId: string, user: AuthUser): Promise<void> {
  const rec = await getStoredProjectRecord(projectId);
  if (!canUserAccessProject(rec, user)) {
    throw new HttpError(
      403,
      `Project '${projectId}' is a private workspace owned by another developer`,
      "PRIVATE_PROJECT_FORBIDDEN"
    );
  }
}

export interface GitNetworkAuthInput {
  remoteUrl: string;
  authType?: GitAuthType;
  httpsUsername?: string;
  httpsToken?: string;
  sshPrivateKey?: string;
}

export async function prepareGitAuthExecution(input: GitNetworkAuthInput): Promise<{
  gitConfigArgs: string[];
  extraEnv: Record<string, string>;
  redactSecrets: (msg: string) => string;
  cleanup: () => Promise<void>;
}> {
  const secretsToRedact: string[] = [];
  const extraEnv: Record<string, string> = {};
  let tempSshDir = "";

  const allowHttp =
    process.env.GIT_ALLOW_INSECURE_HTTP === "true" ||
    process.env.MDTEAM_ALLOW_LOCAL_GIT_REMOTE === "1";

  const gitConfigArgs = [
    "-c",
    "credential.helper=",
    "-c",
    "protocol.allow=never",
    "-c",
    "protocol.https.allow=always",
    "-c",
    "protocol.ssh.allow=always",
  ];
  if (allowHttp) {
    gitConfigArgs.push("-c", "protocol.http.allow=always");
  }

  const effectiveType = input.authType || "none";
  if (effectiveType === "https" && input.httpsToken) {
    const user = (input.httpsUsername || "x-access-token").trim() || "x-access-token";
    const token = input.httpsToken.trim();
    secretsToRedact.push(token);
    const basic = Buffer.from(`${user}:${token}`, "utf8").toString("base64");
    secretsToRedact.push(basic);

    const parsed = new URL(input.remoteUrl);
    extraEnv.GIT_CONFIG_COUNT = "1";
    extraEnv.GIT_CONFIG_KEY_0 = `http.${parsed.origin}/.extraheader`;
    extraEnv.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${basic}`;
  } else if (effectiveType === "ssh" && input.sshPrivateKey) {
    tempSshDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdteam-ssh-"));
    const keyFile = path.join(tempSshDir, "id_ed25519");
    await fs.writeFile(keyFile, input.sshPrivateKey, { encoding: "utf8", mode: 0o600 });
    await fs.chmod(keyFile, 0o600).catch(() => undefined);
    const normalizedKeyFile = keyFile.replace(/\\/g, "/");
    extraEnv.GIT_SSH_COMMAND = `ssh -i "${normalizedKeyFile}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes`;
  }

  return {
    gitConfigArgs,
    extraEnv,
    redactSecrets: (msg: string) => {
      let clean = msg || "";
      for (const s of secretsToRedact) {
        if (s && s.length >= 4) clean = clean.split(s).join("********");
      }
      return clean;
    },
    cleanup: async () => {
      if (tempSshDir) {
        await fs.rm(tempSshDir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}
