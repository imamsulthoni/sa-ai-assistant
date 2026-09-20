import { Hono } from "hono";
import { getAuthUser } from "../../lib/auth.js";
import { ProjectCreateSchema, ProjectUpdateSchema } from "./schema.js";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./service.js";

export const projectModule = new Hono();

function userIdFrom(c: Parameters<typeof getAuthUser>[0]) {
  return getAuthUser(c).id;
}

projectModule.get("/", async (c) => {
  const projects = await listProjects(userIdFrom(c));
  return c.json({ projects });
});

projectModule.post("/", async (c) => {
  const parsed = ProjectCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid project payload", issues: parsed.error.issues }, 400);
  }
  try {
    const project = await createProject(userIdFrom(c), parsed.data);
    return c.json({ project }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create project" },
      400,
    );
  }
});

projectModule.get("/:id", async (c) => {
  const project = await getProject(userIdFrom(c), c.req.param("id"));
  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json({ project });
});

projectModule.patch("/:id", async (c) => {
  const parsed = ProjectUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid project payload", issues: parsed.error.issues }, 400);
  }
  try {
    const project = await updateProject(userIdFrom(c), c.req.param("id"), parsed.data);
    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json({ project });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update project" },
      400,
    );
  }
});

projectModule.delete("/:id", async (c) => {
  const deleted = await deleteProject(userIdFrom(c), c.req.param("id"));
  if (!deleted) return c.json({ error: "Project not found" }, 404);
  return c.json({ ok: true });
});
