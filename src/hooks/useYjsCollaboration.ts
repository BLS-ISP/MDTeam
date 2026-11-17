"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type React from "react";
import type { WorkspaceFile } from "../utils/issueEngine";

const DEFAULT_LOCAL_YJS_URL = "ws://localhost:1234";

export function resolveBrowserAutoYjsUrl(
  loc: { protocol: string; host: string; port: string },
  isTauriRuntime: boolean
): string | null {
  if (isTauriRuntime || !loc.host || loc.port === "3000") {
    return null;
  }
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}/ws`;
}

function encodeYjsRoomSegment(raw: string, fallback: string): string {
  const clean = (raw || "").trim() || fallback;
  return clean.replace(/[^a-zA-Z0-9]/g, (ch) => `_${ch.charCodeAt(0).toString(16)}_`);
}

/**
 * Builds a collision-free Yjs room identifier scoped by project, branch, and file path.
 */
export function buildYjsRoomName(projectId: string, branch: string, filePath: string): string {
  const normalizedPath = (filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const safeProj = encodeYjsRoomSegment(projectId, "default");
  const safeBranch = encodeYjsRoomSegment(branch, "main");
  const safePath = encodeYjsRoomSegment(normalizedPath, "root");
  return `mdteam-${safeProj}-${safeBranch}-${safePath}`;
}

export interface CollaboratorPresence {
  name: string;
  color: string;
  activeFile: string;
  cursorLine: number;
}

export interface UseYjsCollaborationParams {
  activeFilePath: string;
  activeFilePathB: string;
  splitActive: boolean;
  filesRef: React.MutableRefObject<WorkspaceFile[]>;
  editorRef: React.MutableRefObject<any>;
  editorRefB: React.MutableRefObject<any>;
  projectId?: string;
  activeBranch?: string;
  readOnly?: boolean;
  canConnectWs?: boolean;
}

export function useYjsCollaboration({
  activeFilePath,
  activeFilePathB,
  splitActive,
  filesRef,
  editorRef,
  editorRefB,
  projectId = "default",
  activeBranch = "main",
  readOnly = false,
  canConnectWs = true,
}: UseYjsCollaborationParams) {
  const [editorAInstance, setEditorAInstance] = useState<any>(null);
  const [editorBInstance, setEditorBInstance] = useState<any>(null);
  const [yjsUrl, setYjsUrlState] = useState<string>(DEFAULT_LOCAL_YJS_URL);
  const customYjsUrlSetRef = useRef<boolean>(false);
  const setYjsUrl: React.Dispatch<React.SetStateAction<string>> = useCallback((next) => {
    customYjsUrlSetRef.current = true;
    setYjsUrlState(next);
  }, []);
  const [yjsStatus, setYjsStatus] = useState<"connected" | "connecting" | "offline">("offline");
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);

  // Auto-detect reverse-proxy WSS/WS endpoint on NethServer 8 / Docker browser deployments
  useEffect(() => {
    if (typeof window === "undefined" || customYjsUrlSetRef.current) return;
    const isTauriRuntime = Boolean(
      (window as unknown as { __TAURI__?: unknown }).__TAURI__
    );
    const autoUrl = resolveBrowserAutoYjsUrl(window.location, isTauriRuntime);
    if (autoUrl) {
      setYjsUrlState(autoUrl);
    }
  }, []);

  // WebSocket reachability probe (gated by canConnectWs)
  useEffect(() => {
    if (!canConnectWs || !yjsUrl) {
      setYjsStatus("offline");
      setCollaborators([]);
      return;
    }
    if (
      typeof window !== "undefined" &&
      !customYjsUrlSetRef.current &&
      yjsUrl === DEFAULT_LOCAL_YJS_URL
    ) {
      const isTauriRuntime = Boolean(
        (window as unknown as { __TAURI__?: unknown }).__TAURI__
      );
      const autoUrl = resolveBrowserAutoYjsUrl(window.location, isTauriRuntime);
      if (autoUrl && autoUrl !== yjsUrl) {
        return;
      }
    }
    setYjsStatus("connecting");
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(yjsUrl);
      ws.onopen = () => setYjsStatus("connected");
      ws.onerror = () => setYjsStatus("offline");
      ws.onclose = () => setYjsStatus("offline");
    } catch {
      setYjsStatus("offline");
    }
    return () => {
      if (ws) ws.close();
    };
  }, [canConnectWs, yjsUrl]);

  // Yjs real-time sync manager for Editor A
  useEffect(() => {
    if (!canConnectWs || yjsStatus !== "connected" || !yjsUrl || !activeFilePath || !editorAInstance) {
      setCollaborators([]);
      return;
    }

    let cancelled = false;
    let providerA: any = null;
    let bindingA: any = null;
    let docA: any = null;
    let syncAwareness: (() => void) | null = null;

    const setupSync = async () => {
      try {
        const [Y, { WebsocketProvider }, { MonacoBinding }] = await Promise.all([
          import("yjs"),
          import("y-websocket"),
          import("y-monaco"),
        ]);
        if (cancelled) return;

        const model = editorAInstance.getModel();
        if (!model) return;

        docA = new Y.Doc();
        const roomName = buildYjsRoomName(projectId, activeBranch, activeFilePath);
        providerA = new WebsocketProvider(yjsUrl, roomName, docA);
        const ytext = docA.getText("monaco");

        syncAwareness = () => {
          if (!providerA?.awareness || cancelled) return;
          const peers: CollaboratorPresence[] = [];
          providerA.awareness.getStates().forEach((state: any, clientId: number) => {
            if (clientId === providerA.awareness.clientID || !state) return;
            const user = state.user || {};
            const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : `Peer ${clientId}`;
            const color = typeof user.color === "string" && user.color.trim() ? user.color.trim() : "#6366f1";
            const file = typeof state.activeFile === "string" && state.activeFile ? state.activeFile : activeFilePath;
            const rawLine = Number(state.cursorLine ?? state.cursor?.line ?? 1);
            peers.push({ name, color, activeFile: file, cursorLine: Number.isFinite(rawLine) && rawLine >= 1 ? Math.floor(rawLine) : 1 });
          });
          setCollaborators(peers);
        };
        providerA.awareness.on("change", syncAwareness);
        syncAwareness();

        if (!readOnly) {
          const localContent = filesRef.current.find((f) => f.path === activeFilePath)?.content || "";
          providerA.on("sync", (isSynced: boolean) => {
            if (!cancelled && isSynced && ytext.toString() === "" && localContent !== "") {
              docA.transact(() => ytext.insert(0, localContent));
            }
          });
          bindingA = new MonacoBinding(ytext, model, new Set([editorAInstance]), providerA.awareness);
        }
      } catch (err) {
        console.error("Yjs setup failed:", err);
      }
    };

    void setupSync();

    return () => {
      cancelled = true;
      if (providerA?.awareness && syncAwareness) providerA.awareness.off("change", syncAwareness);
      if (bindingA) bindingA.destroy();
      if (providerA) providerA.destroy();
      if (docA) docA.destroy();
      setCollaborators([]);
    };
  }, [activeBranch, activeFilePath, canConnectWs, editorAInstance, filesRef, projectId, readOnly, yjsStatus, yjsUrl]);

  // Yjs real-time sync manager for Editor B (Split Editor)
  useEffect(() => {
    if (!canConnectWs || yjsStatus !== "connected" || !yjsUrl || !splitActive || !activeFilePathB || !editorBInstance) return;

    let cancelled = false;
    let providerB: any = null;
    let bindingB: any = null;
    let docB: any = null;

    const setupSyncB = async () => {
      try {
        const [Y, { WebsocketProvider }, { MonacoBinding }] = await Promise.all([
          import("yjs"),
          import("y-websocket"),
          import("y-monaco"),
        ]);
        if (cancelled) return;
        const model = editorBInstance.getModel();
        if (!model) return;

        docB = new Y.Doc();
        providerB = new WebsocketProvider(yjsUrl, buildYjsRoomName(projectId, activeBranch, activeFilePathB), docB);
        const ytext = docB.getText("monaco");

        if (!readOnly) {
          const localContent = filesRef.current.find((f) => f.path === activeFilePathB)?.content || "";
          providerB.on("sync", (isSynced: boolean) => {
            if (!cancelled && isSynced && ytext.toString() === "" && localContent !== "") {
              docB.transact(() => ytext.insert(0, localContent));
            }
          });
          bindingB = new MonacoBinding(ytext, model, new Set([editorBInstance]), providerB.awareness);
        }
      } catch (err) {
        console.error("Yjs B setup failed:", err);
      }
    };

    void setupSyncB();

    return () => {
      cancelled = true;
      if (bindingB) bindingB.destroy();
      if (providerB) providerB.destroy();
      if (docB) docB.destroy();
    };
  }, [activeBranch, activeFilePathB, canConnectWs, editorBInstance, filesRef, projectId, readOnly, splitActive, yjsStatus, yjsUrl]);

  const applyPeerDecorations = (editor: any, filePath: string, prevDecos: string[]) => {
    const decos = collaborators
      .filter((c) => c.activeFile === filePath)
      .map((collab) => ({
        range: { startLineNumber: collab.cursorLine, startColumn: 1, endLineNumber: collab.cursorLine, endColumn: 2 },
        options: {
          className: `collab-cursor-${collab.name.replace(/\s+/g, "")}`,
          hoverMessage: { value: `${collab.name} editiert hier` },
        },
      }));
    return editor.deltaDecorations(prevDecos, decos);
  };

  const collabsDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    if (editorRef.current && activeFilePath) {
      collabsDecorationsRef.current = applyPeerDecorations(editorRef.current, activeFilePath, collabsDecorationsRef.current);
    }
  }, [activeFilePath, collaborators, editorRef]);

  const collabsDecorationsRefB = useRef<string[]>([]);
  useEffect(() => {
    if (editorRefB.current && activeFilePathB && splitActive) {
      collabsDecorationsRefB.current = applyPeerDecorations(editorRefB.current, activeFilePathB, collabsDecorationsRefB.current);
    }
  }, [activeFilePathB, collaborators, splitActive, editorRefB]);

  return {
    editorAInstance,
    setEditorAInstance,
    editorBInstance,
    setEditorBInstance,
    yjsUrl,
    setYjsUrl,
    yjsStatus,
    collaborators,
  };
}
