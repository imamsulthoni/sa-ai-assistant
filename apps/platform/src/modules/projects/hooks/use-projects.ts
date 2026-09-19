import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  getProject,
  listProjects,
  updateProject as apiUpdateProject,
  type ProjectSummary,
} from "#/lib/api";
import { describeError } from "#/lib/errors";

export function useProject(projectId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId).then((response) => response.project),
  });
  return {
    project: query.data ?? null,
    loading: query.isPending,
    error: query.isError ? describeError(query.error) : null,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  };
}

export function useProjects() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects().then((response) => response.projects),
  });

  const error =
    actionError ?? (projectsQuery.isError ? describeError(projectsQuery.error) : null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: apiCreateProject,
    onSuccess: invalidate,
    onError: (caught) => setActionError(describeError(caught)),
  });

  const createProject = useCallback(
    async (input: { name: string; description?: string | null }) => {
      setActionError(null);
      return createMutation.mutateAsync(input);
    },
    [createMutation],
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiUpdateProject(id, { name }),
    onSuccess: invalidate,
    onError: (caught) => setActionError(describeError(caught)),
  });

  const renameProject = useCallback(
    async (id: string, name: string) => {
      setActionError(null);
      await updateMutation.mutateAsync({ id, name });
    },
    [updateMutation],
  );

  const deleteMutation = useMutation({
    mutationFn: apiDeleteProject,
    onSuccess: invalidate,
    onError: (caught) => setActionError(describeError(caught)),
  });

  const deleteProject = useCallback(
    async (id: string) => {
      setActionError(null);
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  const projects: ProjectSummary[] = projectsQuery.data ?? [];

  return {
    projects,
    loading: projectsQuery.isPending,
    error,
    createProject,
    renameProject,
    deleteProject,
    creating: createMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}