import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { UseChatStatus } from "@anvia/react";
import { ArrowLeft, Bot, Plus, RotateCcw } from "lucide-react";
import { Badge, type BadgeTone } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { AnviaChat } from "#/modules/chat/anvia-chat";
import { createProject, createSession, listProjects } from "#/lib/api";
import { describeError } from "#/lib/errors";

export const Route = createFileRoute("/agent-demo")({ component: AgentDemoPage });

const STATUS_LABEL: Record<UseChatStatus, string> = {
  ready: "Siap",
  submitted: "Mengirim…",
  streaming: "Streaming…",
  waiting: "Menunggu agen…",
  error: "Error",
};

const STATUS_TONE: Record<UseChatStatus, BadgeTone> = {
  ready: "success",
  submitted: "info",
  streaming: "info",
  waiting: "warning",
  error: "danger",
};

function AgentDemoPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<UseChatStatus>("ready");
  const bootstrapped = useRef(false);

  const createAgentSession = useCallback(async () => {
    setError(null);
    setStatus("ready");
    setSessionId(null);
    try {
      // Sesi selalu terikat project; demo memakai project pertama atau membuatnya.
      let targetProjectId = projectId;
      if (!targetProjectId) {
        const { projects } = await listProjects();
        targetProjectId = projects[0]?.id ?? null;
        if (!targetProjectId) {
          const created = await createProject({ name: "Agent Demo" });
          targetProjectId = created.project.id;
        }
        setProjectId(targetProjectId);
      }
      const response = await createSession({ projectId: targetProjectId });
      setSessionId(response.session.id);
    } catch (caught) {
      setError(describeError(caught));
    }
  }, [projectId]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void createAgentSession();
  }, [createAgentSession]);

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-100 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Bot size={15} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">Demo Chat Agent</h1>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Uji respon agen secara langsung — tanpa alur BRD, tanpa template.
            </p>
          </div>
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {sessionId && (
            <span className="hidden rounded border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500 sm:inline dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {sessionId.slice(0, 8)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void createAgentSession()}>
            {sessionId ? <Plus size={12} /> : <RotateCcw size={12} />} Sesi baru
          </Button>
          <Link to="/workspace">
            <Button variant="outline" size="sm">
              <ArrowLeft size={12} /> Workspace
            </Button>
          </Link>
        </div>
      </header>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          Gagal membuat sesi: {error}
        </div>
      )}

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col border-x border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {sessionId && projectId ? (
          <AnviaChat
            key={sessionId}
            sessionId={sessionId}
            projectId={projectId}
            initialMessages={[]}
            onStatusChange={setStatus}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            {error ? "Sesi demo tidak tersedia." : "Menyiapkan sesi agen…"}
          </div>
        )}
      </div>
    </div>
  );
}
