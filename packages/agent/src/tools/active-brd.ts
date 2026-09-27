import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters, type ActiveBrdVersion } from "./context.js";
import { brdTitle, findBrdSection, renderBrdOutline } from "./brd-outline.js";

const MAX_SECTION_CHARS = 8000;

export type ActiveBrdToolOptions = {
  /**
   * Bila false, mode "full" tidak dikembalikan ke model. Dipakai pada QA agar
   * jawaban/pertanyaan biasa tidak pernah menarik seluruh dokumen.
   */
  allowFull?: boolean;
};

const FULL_DISABLED_GAP =
  "mode=full dinonaktifkan pada alur ini. Baca bagian yang relevan dengan mode=section, lalu rangkum dari bagian-bagian tersebut.";

export function createActiveBrdTool(
  adapters: AgentContextAdapters = {},
  options: ActiveBrdToolOptions = {},
) {
  const allowFull = options.allowFull ?? true;
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "get_active_brd",
    description: allowFull
      ? "Read the selected BRD. Modes: outline (default — section list, requirement ids, and version metadata; cheapest), section (full body of one section, pass `section` as an id or title fragment), full (entire markdown; use only for whole-document analysis the user explicitly asked for). The active session and user are resolved automatically from the current conversation — never ask the user for a session ID, user ID, or BRD ID."
      : "Read the selected BRD. Modes: outline (default — section list, requirement ids, and version metadata; cheapest), section (full body of one section, pass `section` as an id or title fragment). mode=full tidak tersedia pada alur ini — jangan memintanya; rangkum dari outline dan section. The active session and user are resolved automatically from the current conversation — never ask the user for a session ID, user ID, or BRD ID.",
    inputSchema: z.object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      brdId: z.string().optional(),
      mode: z
        .enum(["outline", "section", "full"])
        .optional()
        .describe(
          allowFull
            ? "Default outline; use section for one section body and full only for whole-document analysis."
            : "Default outline; use section for one section body. full tidak tersedia.",
        ),
      section: z
        .string()
        .optional()
        .describe("Section id or title fragment; required when mode=section."),
    }),
    execute: async ({ userId, sessionId, brdId, mode: requestedMode, section }) => {
      const mode = requestedMode ?? "outline";
      const brd = await resolved.getActiveBrd({ userId, sessionId, brdId });
      if (!brd) {
        return {
          found: false as const,
          mode,
          title: null,
          chars: 0,
          versions: [] as readonly ActiveBrdVersion[],
          outline: null,
          section: null,
          contentMarkdown: null,
          gaps: ["BRD aktif tidak ditemukan."],
        };
      }

      const versions = brd.versions as readonly ActiveBrdVersion[];
      const title = brdTitle(brd.contentMarkdown);
      const base = {
        found: true as const,
        title,
        chars: brd.contentMarkdown.length,
        versions,
      };

      if (mode === "full") {
        if (!allowFull) {
          return {
            ...base,
            mode: "outline" as const,
            outline: renderBrdOutline(brd.contentMarkdown, versions),
            section: null,
            contentMarkdown: null,
            gaps: [FULL_DISABLED_GAP],
          };
        }
        return {
          ...base,
          mode,
          outline: null,
          section: null,
          contentMarkdown: brd.contentMarkdown,
          userNotice:
            "Dokumen penuh dimuat. Gunakan hanya untuk analisis menyeluruh; untuk pertanyaan atau edit spesifik pakai mode outline/section.",
        };
      }

      if (mode === "section") {
        const ref = section?.trim();
        if (!ref) {
          return {
            ...base,
            mode,
            outline: renderBrdOutline(brd.contentMarkdown, versions),
            section: null,
            contentMarkdown: null,
            gaps: ["mode=section memerlukan parameter `section` (id atau potongan judul)."],
          };
        }
        const found = findBrdSection(brd.contentMarkdown, ref);
        if (!found) {
          return {
            ...base,
            mode,
            outline: renderBrdOutline(brd.contentMarkdown, versions),
            section: null,
            contentMarkdown: null,
            gaps: [
              `Section "${ref}" tidak ditemukan. Pilih judul/id dari outline lalu ulangi dengan nilai yang tepat.`,
            ],
          };
        }
        const truncated = found.content.length > MAX_SECTION_CHARS;
        return {
          ...base,
          mode,
          outline: null,
          section: {
            id: found.node.id,
            title: found.node.title,
            level: found.node.level,
            chars: found.node.chars,
            requirementIds: found.node.requirementIds,
            truncated,
            content: truncated
              ? `${found.content.slice(0, MAX_SECTION_CHARS)}\n… (section dipotong)`
              : found.content,
          },
          contentMarkdown: null,
        };
      }

      return {
        ...base,
        mode: "outline" as const,
        outline: renderBrdOutline(brd.contentMarkdown, versions),
        section: null,
        contentMarkdown: null,
      };
    },
  });
}

export const getActiveBrdTool = createActiveBrdTool();
