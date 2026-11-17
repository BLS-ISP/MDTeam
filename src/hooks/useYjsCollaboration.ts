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

export interface CollaboratorPresence {
  name: string;
  color: string;
  activeFile: string;
  cursorLine: number;
}

interface UseYjsCollaborationParams {
  activeFilePath: string;
  activeFilePathB: string;
  splitActive: boolean;
  filesRef: React.MutableRefObject<WorkspaceFile[]>;
  editorRef: React.MutableRefObject<any>;
  editorRefB: React.MutableRefObject<any>;
}

export function useYjsCollaboration({
  activeFilePath,
  activeFilePathB,
  splitActive,
  filesRef,
  editorRef,
  editorRefB,
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
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([
    { name: "Bob Dev", color: "#ef4444", activeFile: "arc42/01_introduction_goals.md", cursorLine: 12 },
    { name: "Alice Arch", color: "#10b981", activeFile: "arc42/02_constraints.md", cursorLine: 5 },
  ]);

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

  // WebSocket reachability probe
  useEffect(() => {
    if (!yjsUrl) {
      setYjsStatus("offline");
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
      ws.onopen = () => {
        setYjsStatus("connected");
      };
      ws.onerror = () => {
        setYjsStatus("offline");
      };
      ws.onclose = () => {
        setYjsStatus("offline");
      };
    } catch {
      setYjsStatus("offline");
    }
    return () => {
      if (ws) ws.close();
    };
  }, [yjsUrl]);

  // Yjs real-time sync manager for Editor A
  useEffect(() => {
    if (yjsStatus !== "connected" || !yjsUrl || !activeFilePath || !editorAInstance) {
      return;
    }

    let providerA: any = null;
    let bindingA: any = null;
    let docA: any = null;

    const setupSync = async () => {
      try {
        const Y = await import("yjs");
        const { WebsocketProvider } = await import("y-websocket");
        const { MonacoBinding } = await import("y-monaco");

        const model = editorAInstance.getModel();
        if (model) {
          docA = new Y.Doc();
          const roomName = `mdteam-room-${activeFilePath.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          providerA = new WebsocketProvider(yjsUrl, roomName, docA);
          const ytext = docA.getText("monaco");

          const localContent = filesRef.current.find((f) => f.path === activeFilePath)?.content || "";
          providerA.on("sync", (isSynced: boolean) => {
            if (isSynced && ytext.toString() === "" && localContent !== "") {
              docA.transact(() => {
                ytext.insert(0, localContent);
              });
            }
          });

          bindingA = new MonacoBinding(ytext, model, new Set([editorAInstance]), providerA.awareness);
        }
      } catch (err) {
        console.error("Yjs setup failed:", err);
      }
    };

    setupSync();

    return () => {
      if (bindingA) bindingA.destroy();
      if (providerA) providerA.destroy();
      if (docA) docA.destroy();
    };
  }, [activeFilePath, yjsStatus, yjsUrl, editorAInstance, filesRef]);

  // Yjs real-time sync manager for Editor B (Split Editor)
  useEffect(() => {
    if (yjsStatus !== "connected" || !yjsUrl || !splitActive || !activeFilePathB || !editorBInstance) {
      return;
    }

    let providerB: any = null;
    let bindingB: any = null;
    let docB: any = null;

    const setupSyncB = async () => {
      try {
        const Y = await import("yjs");
        const { WebsocketProvider } = await import("y-websocket");
        const { MonacoBinding } = await import("y-monaco");

        const model = editorBInstance.getModel();
        if (model) {
          docB = new Y.Doc();
          const roomName = `mdteam-room-${activeFilePathB.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          providerB = new WebsocketProvider(yjsUrl, roomName, docB);
          const ytext = docB.getText("monaco");

          const localContent = filesRef.current.find((f) => f.path === activeFilePathB)?.content || "";
          providerB.on("sync", (isSynced: boolean) => {
            if (isSynced && ytext.toString() === "" && localContent !== "") {
              docB.transact(() => {
                ytext.insert(0, localContent);
              });
            }
          });

          bindingB = new MonacoBinding(ytext, model, new Set([editorBInstance]), providerB.awareness);
        }
      } catch (err) {
        console.error("Yjs B setup failed:", err);
      }
    };

    setupSyncB();

    return () => {
      if (bindingB) bindingB.destroy();
      if (providerB) providerB.destroy();
      if (docB) docB.destroy();
    };
  }, [activeFilePathB, yjsStatus, yjsUrl, splitActive, editorBInstance, filesRef]);

  // Simulate collaborators cursors moving
  useEffect(() => {
    const interval = setInterval(() => {
      setCollaborators((prev) =>
        prev.map((c) => {
          if (c.name === "Bob Dev") {
            const newLine = 4 + Math.floor(Math.random() * 14);
            return { ...c, cursorLine: newLine };
          }
          return c;
        })
      );
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Set decorator line marks for collaborators in Monaco Editor A
  const collabsDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    if (editorRef.current && activeFilePath) {
      const editor = editorRef.current;
      const activeCollabs = collaborators.filter((c) => c.activeFile === activeFilePath);

      const newDecorations = activeCollabs.map((collab) => ({
        range: {
          startLineNumber: collab.cursorLine,
          startColumn: 1,
          endLineNumber: collab.cursorLine,
          endColumn: 2,
        },
        options: {
          className: `collab-cursor-${collab.name.replace(/\s+/g, "")}`,
          hoverMessage: { value: `${collab.name} editiert hier` },
        },
      }));

      collabsDecorationsRef.current = editor.deltaDecorations(collabsDecorationsRef.current, newDecorations);
    }
  }, [activeFilePath, collaborators, editorRef]);

  // Set decorator line marks for collaborators in Monaco Editor B
  const collabsDecorationsRefB = useRef<string[]>([]);
  useEffect(() => {
    if (editorRefB.current && activeFilePathB && splitActive) {
      const editor = editorRefB.current;
      const activeCollabs = collaborators.filter((c) => c.activeFile === activeFilePathB);

      const newDecorations = activeCollabs.map((collab) => ({
        range: {
          startLineNumber: collab.cursorLine,
          startColumn: 1,
          endLineNumber: collab.cursorLine,
          endColumn: 2,
        },
        options: {
          className: `collab-cursor-${collab.name.replace(/\s+/g, "")}`,
          hoverMessage: { value: `${collab.name} editiert hier` },
        },
      }));

      collabsDecorationsRefB.current = editor.deltaDecorations(collabsDecorationsRefB.current, newDecorations);
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
