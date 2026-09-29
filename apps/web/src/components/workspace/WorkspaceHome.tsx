import {
  scopeProjectRef,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import { connectionStatusTitle } from "@t3tools/client-runtime/connection";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CircleDotIcon,
  CommandIcon,
  FolderCodeIcon,
  GitBranchIcon,
  MonitorIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { openCommandPalette } from "../../commandPaletteBus";
import { isElectron } from "../../env";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useNowMinute } from "../../hooks/useNowMinute";
import { cn } from "../../lib/utils";
import {
  useAllEnvironmentShellsBootstrapped,
  useProjects,
  useThreadShells,
} from "../../state/entities";
import { useEnvironments } from "../../state/environments";
import { buildThreadRouteParams } from "../../threadRoutes";
import type { Project } from "../../types";
import { WorkspaceUpdatedTime } from "./WorkspaceUpdatedTime";
import { ProjectFavicon } from "../ProjectFavicon";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SidebarInset } from "../ui/sidebar";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  buildWorkspaceOverview,
  filterWorkspaceThreads,
  type WorkspaceFilter,
} from "./workspaceOverview";

const FILTERS: readonly { value: WorkspaceFilter; label: string }[] = [
  { value: "all", label: "All threads" },
  { value: "attention", label: "Needs attention" },
  { value: "working", label: "Working" },
];

export function WorkspaceHome() {
  const projects = useProjects();
  const threads = useThreadShells();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const { environments } = useEnvironments();
  const newThread = useNewThreadHandler();
  const [filter, setFilter] = useState<WorkspaceFilter>("all");
  const [query, setQuery] = useState("");
  const [rowLimit, setRowLimit] = useState(12);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [startingProject, setStartingProject] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const nowMinute = useNowMinute();
  const [snoozeWakeTick, bumpSnoozeWakeTick] = useState(0);
  const environmentById = useMemo(
    () => new Map(environments.map((environment) => [environment.environmentId, environment])),
    [environments],
  );
  const connectedIds = useMemo(
    () =>
      new Set(
        environments
          .filter((environment) => environment.connection.phase === "connected")
          .map((environment) => environment.environmentId),
      ),
    [environments],
  );
  const overview = useMemo(() => {
    // Minute ticks recover from suspended tabs; the wake timer handles precise deadlines.
    void nowMinute;
    void snoozeWakeTick;
    return buildWorkspaceOverview(projects, threads, connectedIds, new Date().toISOString());
    // oxlint-disable-next-line react/memo-dependencies -- Clock signals invalidate time-derived snooze states without a server event.
  }, [projects, threads, connectedIds, nowMinute, snoozeWakeTick]);
  useEffect(() => {
    if (overview.nextSnoozeWakeAt === null) return;
    // Clamp long snoozes to avoid overflowing the browser's signed 32-bit timer.
    const delay = Math.min(Math.max(0, overview.nextSnoozeWakeAt - Date.now()) + 50, 2_147_483_647);
    const timer = window.setTimeout(() => bumpSnoozeWakeTick((tick) => tick + 1), delay);
    return () => window.clearTimeout(timer);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- A clamped far-future wake must re-arm even when the deadline is unchanged.
  }, [overview.nextSnoozeWakeAt, snoozeWakeTick]);
  const filteredRows = useMemo(
    () => filterWorkspaceThreads(overview.rows, query, filter),
    [overview.rows, query, filter],
  );
  const hasLoadedWork = projects.length > 0 || overview.rows.length > 0;
  const allEnvironmentsOffline = environments.length > 0 && connectedIds.size === 0;
  const providerCount = useMemo(
    () =>
      environments.reduce(
        (count, environment) =>
          count +
          (connectedIds.has(environment.environmentId)
            ? (environment.serverConfig?.providers.filter(
                (provider) => provider.enabled && provider.installed && provider.status === "ready",
              ).length ?? 0)
            : 0),
        0,
      ),
    [environments, connectedIds],
  );

  const startProject = async (project: Project, key: string) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStartingProject(key);
    setStartError(null);
    try {
      const result = await newThread(scopeProjectRef(project.environmentId, project.id));
      if (result === null)
        setStartError(`Could not open ${project.title}. Reconnect the environment and try again.`);
    } catch {
      setStartError(`Could not open ${project.title}. The project is still available; try again.`);
    } finally {
      startingRef.current = false;
      setStartingProject(null);
    }
  };
  const selectFilter = (next: WorkspaceFilter) => {
    setFilter(next);
    setRowLimit(12);
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <a
        href="#ade-workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:outline-2 focus:outline-ring"
      >
        Skip to workspace
      </a>
      <WorkspacePageHeader electron={isElectron} className="border-b border-border">
        <span className="text-sm font-medium">Workspace</span>
        <span className="hidden text-muted-foreground/60 sm:inline" aria-hidden="true">
          /
        </span>
        <span className="hidden text-sm text-muted-foreground sm:inline">Overview</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open command palette"
            onClick={() => openCommandPalette()}
          >
            <CommandIcon />
          </Button>
          <Button variant="outline" size="sm" render={<Link to="/settings" />}>
            <SlidersHorizontalIcon />
            Settings
          </Button>
        </div>
      </WorkspacePageHeader>

      <div
        id="ade-workspace"
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
      >
        <div className="mx-auto max-w-[1240px] px-5 py-9 sm:px-9 sm:py-12 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-3 font-mono text-2xs tracking-widest text-muted-foreground">
                AGENT DEVELOPMENT ENVIRONMENT
              </p>
              <h1 className="text-3xl font-semibold tracking-tighter sm:text-4xl">
                Your work, in focus.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                One workspace for your projects, agents, and next idea.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => openCommandPalette({ open: "add-project" })}>
                <PlusIcon /> Add project
              </Button>
              {projects.length > 0 ? (
                <Button onClick={() => openCommandPalette({ open: "new-thread-in" })}>
                  New thread <ArrowUpRightIcon />
                </Button>
              ) : null}
            </div>
          </div>

          <section
            aria-label="Workspace activity"
            className="mt-9 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card"
          >
            {[
              {
                value: "all" as const,
                label: "Threads",
                count: overview.rows.length,
                Icon: FolderCodeIcon,
              },
              {
                value: "working" as const,
                label: "Working",
                count: overview.workingCount,
                Icon: CircleDotIcon,
              },
              {
                value: "attention" as const,
                label: "Needs attention",
                count: overview.attentionCount,
                Icon: CheckIcon,
              },
            ].map(({ value, label, count, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => selectFilter(value)}
                className="group min-w-0 px-4 py-5 text-left outline-none transition-colors hover:bg-accent focus-visible:relative focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
              >
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon aria-hidden="true" className="hidden size-3.5 sm:block" />
                  {label}
                </span>
                <span
                  className={cn(
                    "mt-2 block font-mono text-2xl tracking-tight tabular-nums",
                    value === "attention" && count > 0 && "text-warning-foreground",
                  )}
                >
                  {bootstrapped || overview.rows.length > 0
                    ? count.toString().padStart(2, "0")
                    : "—"}
                </span>
              </button>
            ))}
          </section>

          {!bootstrapped && hasLoadedWork ? (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              Showing available work while other environments connect.
            </p>
          ) : null}

          {startError ? (
            <div
              role="alert"
              className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive-foreground"
            >
              {startError}
            </div>
          ) : null}

          <section aria-labelledby="ade-projects-title" className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="ade-projects-title" className="text-sm font-semibold">
                Projects{" "}
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                  {projects.length}
                </span>
              </h2>
              {projects.length > 4 ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAllProjects(!showAllProjects)}
                >
                  {showAllProjects ? "Show less" : "View all projects"}
                </Button>
              ) : null}
            </div>
            {!bootstrapped && projects.length === 0 ? (
              <WorkspaceSkeleton />
            ) : projects.length === 0 && allEnvironmentsOffline ? (
              <div className="rounded-lg border border-border px-6 py-10 sm:px-10">
                <MonitorIcon className="mb-5 size-6 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-lg font-medium tracking-tight">Reconnect to your work.</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Your environments are offline. Reconnect a machine to load its projects and
                  threads.
                </p>
                <div className="mt-6">
                  <Button render={<Link to="/settings/connections" />}>
                    Open Connections <ArrowRightIcon />
                  </Button>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-6 py-10 sm:px-10">
                <FolderCodeIcon className="mb-5 size-6 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-lg font-medium tracking-tight">Start with a project.</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Open a local folder or connect a remote machine. Your agents work with your files
                  and the subscriptions you already use.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => openCommandPalette({ open: "add-project" })}>
                    <PlusIcon /> Add your first project
                  </Button>
                  <Button variant="ghost" render={<Link to="/settings/connections" />}>
                    Connect a machine <ArrowRightIcon />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {overview.projects
                  .slice(0, showAllProjects ? undefined : 4)
                  .map(({ project, key, threadCount }) => {
                    const environment = environmentById.get(project.environmentId);
                    const connected = connectedIds.has(project.environmentId);
                    const projectLabel =
                      environments.length > 1
                        ? `${project.title} on ${environment?.label ?? "an unavailable environment"}`
                        : project.title;
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-disabled={!connected || startingProject !== null}
                              aria-busy={startingProject === key}
                              onClick={() => {
                                if (connected && startingProject === null) {
                                  void startProject(project, key);
                                }
                              }}
                              aria-label={
                                connected
                                  ? `Start a thread in ${projectLabel}`
                                  : `${projectLabel} is offline. Reconnect in Connections to start a thread.`
                              }
                              className="group min-w-0 rounded-lg border border-border bg-card p-5 text-left outline-none transition-colors hover:border-muted-foreground/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                            />
                          }
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                              <ProjectFavicon project={project} className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {project.title}
                              </span>
                              <span className="mt-0.5 block truncate font-mono text-2xs text-muted-foreground">
                                {project.workspaceRoot}
                              </span>
                            </span>
                            <ArrowUpRightIcon
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                            />
                          </span>
                          <span className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-2xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  connected ? "bg-success" : "bg-muted-foreground",
                                )}
                              />
                              {environment?.label ?? "Unavailable environment"}
                            </span>
                            <span>
                              {startingProject === key
                                ? "Opening…"
                                : !connected
                                  ? "Offline · reconnect"
                                  : `${threadCount} ${threadCount === 1 ? "thread" : "threads"}`}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipPopup>
                          {connected
                            ? project.workspaceRoot
                            : `Reconnect ${environment?.label ?? "this environment"} to start a thread`}
                        </TooltipPopup>
                      </Tooltip>
                    );
                  })}
              </div>
            )}
          </section>

          <section aria-labelledby="ade-threads-title" className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="ade-threads-title" className="text-sm font-semibold">
                Recent work
              </h2>
              <div className="w-full sm:w-64">
                <Input
                  type="search"
                  size="compact"
                  aria-label="Filter threads by title, project, or branch"
                  placeholder="Filter by thread, project, branch…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setRowLimit(12);
                  }}
                />
              </div>
            </div>
            <div
              className="mb-4 flex flex-wrap gap-1"
              role="group"
              aria-label="Filter threads by status"
            >
              {FILTERS.map((item) => (
                <Button
                  key={item.value}
                  variant={filter === item.value ? "secondary" : "ghost-muted"}
                  size="sm"
                  aria-pressed={filter === item.value}
                  onClick={() => selectFilter(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            {!bootstrapped && overview.rows.length === 0 ? (
              <WorkspaceSkeleton />
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-border px-6 py-10 text-center">
                {filter === "attention" && query.trim() === "" ? (
                  <CheckIcon className="mb-3 size-5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <SearchIcon className="mb-3 size-5 text-muted-foreground" aria-hidden="true" />
                )}
                <h3 className="text-sm font-medium">
                  {!bootstrapped
                    ? "No matching threads loaded yet"
                    : allEnvironmentsOffline && overview.rows.length === 0
                      ? "No threads loaded"
                      : query.trim()
                        ? "No matching threads"
                        : filter === "attention"
                          ? "Nothing needs your attention"
                          : filter === "working"
                            ? "No agents working right now"
                            : "Your next idea starts here"}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {!bootstrapped
                    ? "More work may appear when all environments finish connecting."
                    : allEnvironmentsOffline && overview.rows.length === 0
                      ? "Reconnect a machine to see its recent work."
                      : query.trim()
                        ? "Try a different title, project, or branch."
                        : filter === "all"
                          ? "Start a thread in a project to begin."
                          : "New activity will appear here as your agents work."}
                </p>
                {query || filter !== "all" ? (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        selectFilter("all");
                      }}
                    >
                      Show all threads
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="hidden grid-cols-[minmax(0,1fr)_8rem_5rem] gap-4 border-b border-border bg-card px-5 py-2.5 font-mono text-3xs tracking-wide text-muted-foreground sm:grid">
                  <span>THREAD / PROJECT</span>
                  <span>STATUS</span>
                  <span className="text-right">UPDATED</span>
                </div>
                <ul className="divide-y divide-border">
                  {filteredRows.slice(0, rowLimit).map(({ thread, project, state }) => (
                    <li key={scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))}>
                      <Link
                        to="/$environmentId/$threadId"
                        params={buildThreadRouteParams(
                          scopeThreadRef(thread.environmentId, thread.id),
                        )}
                        className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_8rem_5rem]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{thread.title}</span>
                          <span className="mt-1.5 flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
                            <span className="truncate">
                              {project.title}
                              {environments.length > 1
                                ? ` · ${environmentById.get(thread.environmentId)?.label ?? "Unavailable environment"}`
                                : null}
                            </span>
                            {thread.branch ? (
                              <>
                                <span aria-hidden="true">/</span>
                                <GitBranchIcon className="size-3 shrink-0" aria-hidden="true" />
                                <span className="truncate font-mono">{thread.branch}</span>
                              </>
                            ) : null}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-2xs",
                            state.tone === "warning"
                              ? "text-warning-foreground"
                              : state.tone === "error"
                                ? "text-destructive-foreground"
                                : state.tone === "success"
                                  ? "text-success-foreground"
                                  : "text-muted-foreground",
                          )}
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-current" />
                          {state.label}
                        </span>
                        <WorkspaceUpdatedTime timestamp={thread.updatedAt} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {filteredRows.length > rowLimit ? (
                  <div className="flex justify-center border-t border-border p-3">
                    <Button variant="ghost" size="sm" onClick={() => setRowLimit(rowLimit + 12)}>
                      Show more threads ({filteredRows.length - rowLimit})
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-5 text-2xs text-muted-foreground">
            <Link
              to="/settings/connections"
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MonitorIcon className="size-3.5" aria-hidden="true" />
              {environments.length === 0
                ? "Connect a machine"
                : environments.map((environment) => (
                    <span key={environment.environmentId} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          environment.connection.phase === "connected"
                            ? "bg-success"
                            : "bg-warning",
                        )}
                      />
                      {environment.label} · {connectionStatusTitle(environment.connection)}
                    </span>
                  ))}
            </Link>
            <Link
              to="/settings/providers"
              className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {providerCount} {providerCount === 1 ? "agent" : "agents"} ready{" "}
              <span aria-hidden="true">↗</span>
            </Link>
          </footer>
        </div>
      </div>
    </SidebarInset>
  );
}

function WorkspaceSkeleton() {
  return (
    <div aria-label="Loading workspace" role="status" className="space-y-3">
      <Skeleton className="h-20 w-full" shape="card" />
      <Skeleton className="h-20 w-full" shape="card" />
      <span className="sr-only">Loading projects and threads…</span>
    </div>
  );
}
