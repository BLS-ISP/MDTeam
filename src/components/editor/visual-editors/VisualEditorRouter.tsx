"use client";

import React from "react";
import { useWorkspaceContext } from "../../../context/WorkspaceContext";
import { AgileIssueVisualForm } from "./AgileIssueVisualForm";
import { BacklogVisualForm, ChecklistVisualForm } from "./BacklogAndChecklistForms";
import { CapacityVisualForm, BurndownVisualForm } from "./CapacityAndBurndownForms";
import { RoadmapVisualForm, RetroVisualForm } from "./RoadmapAndRetroForms";
import { GenericBlockEditor } from "./GenericBlockEditor";

export function VisualEditorRouter({ filePath }: { filePath?: string }) {
  const { activeFilePath } = useWorkspaceContext();
  const targetPath = filePath ?? activeFilePath;
  const cleanPath = targetPath.toLowerCase().replace(/\\/g, "/");

  if (cleanPath.startsWith("issues/")) {
    return <AgileIssueVisualForm filePath={targetPath} />;
  }
  if (cleanPath.endsWith("sprint-backlog.md")) {
    return <BacklogVisualForm />;
  }
  if (cleanPath.endsWith("capacity.md")) {
    return <CapacityVisualForm />;
  }
  if (cleanPath.endsWith("roadmap.md")) {
    return <RoadmapVisualForm />;
  }
  if (cleanPath.endsWith("burndown.md")) {
    return <BurndownVisualForm />;
  }
  if (cleanPath.includes("definition-of-")) {
    return <ChecklistVisualForm filePath={targetPath} />;
  }
  if (cleanPath.includes("retro")) {
    return <RetroVisualForm filePath={targetPath} />;
  }
  return <GenericBlockEditor filePath={targetPath} />;
}
