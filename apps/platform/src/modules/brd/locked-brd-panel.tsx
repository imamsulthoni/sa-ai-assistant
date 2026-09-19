import { Lock, Plus } from "lucide-react";
import { Button } from "#/components/base/button";
import { COPY } from "#/lib/copy";

type LockedBrdPanelProps = {
  onNewProject: () => void;
  onOpenBrd?: () => void;
};

/**
 * Satu project hanya boleh punya satu BRD. Panel ini menggantikan form
 * generate/import ketika project sudah memiliki BRD.
 */
export function LockedBrdPanel({ onNewProject, onOpenBrd }: LockedBrdPanelProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Lock size={20} />
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
          {COPY.projects.newBrdLocked}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          {COPY.projects.newBrdLockedBody}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onOpenBrd && (
          <Button variant="outline" onClick={onOpenBrd}>
            {COPY.projects.openBrd}
          </Button>
        )}
        <Button onClick={onNewProject}>
          <Plus size={14} />
          {COPY.projects.createAnother}
        </Button>
      </div>
    </div>
  );
}