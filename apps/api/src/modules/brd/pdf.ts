import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import MarkdownIt from "markdown-it";

export type BrdPdfInput = {
  title: string;
  version: number;
  status: string;
  updatedAt: Date;
  contentMarkdown: string;
};

type InlineRun = { text: string; font: "regular" | "bold" | "italic" | "mono" };
type InlineToken = { type: string; content?: string };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_SPACE = 44;

const COLORS = {
  ink: rgb(0.15, 0.15, 0.2),
  muted: rgb(0.45, 0.45, 0.5),
  line: rgb(0.82, 0.82, 0.86),
  codeBackground: rgb(0.96, 0.96, 0.98),
  primary: rgb(0.31, 0.27, 0.9),
  watermark: rgb(0.9, 0.9, 0.93),
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN REVIEW",
  APPROVED: "APPROVED",
};

/** pdf-lib standard fonts use WinAnsi; normalise common typography first. */
function sanitize(text: string): string {
  return text
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, "    ")
    .replace(/[^\x20-\xFF]/g, "?");
}

class PdfWriter {
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN;
  readonly pages: PDFPage[] = [];

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont },
  ) {
    this.page = this.newPage();
  }

  private newPage(): PDFPage {
    const page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(page);
    this.y = PAGE_HEIGHT - MARGIN;
    return page;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN + FOOTER_SPACE) {
      this.page = this.newPage();
    }
  }

  get cursor() {
    return this.y;
  }

  moveDown(amount: number) {
    this.y -= amount;
  }

  font(name: InlineRun["font"]): PDFFont {
    if (name === "bold") return this.fonts.bold;
    if (name === "italic") return this.fonts.italic;
    if (name === "mono") return this.fonts.mono;
    return this.fonts.regular;
  }

  drawRuns(runs: InlineRun[], size: number, indent = 0) {
    const wrapped = wrapRuns(runs, this.fonts, size, CONTENT_WIDTH - indent);
    for (const line of wrapped) {
      this.ensureSpace(size * 1.5);
      let x = MARGIN + indent;
      for (const run of line) {
        if (!run.text) continue;
        this.page.drawText(sanitize(run.text), {
          x,
          y: this.y - size,
          size,
          font: this.font(run.font),
          color: COLORS.ink,
        });
        x += this.font(run.font).widthOfTextAtSize(sanitize(run.text), size);
      }
      this.y -= size * 1.45;
    }
  }

  drawRule() {
    this.ensureSpace(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y - 4 },
      thickness: 0.7,
      color: COLORS.line,
    });
    this.y -= 12;
  }

  drawCodeBlock(lines: string[], note?: string) {
    const size = 8;
    const padding = 8;
    const lineHeight = size * 1.5;
    const wrappedLines = lines.flatMap((line) =>
      wrapRuns(
        [{ text: line || " ", font: "mono" }],
        this.fonts,
        size,
        CONTENT_WIDTH - padding * 2,
      ).map((runs) => runs.map((run) => run.text).join("")),
    );
    const blockHeight = wrappedLines.length * lineHeight + padding * 2 + (note ? 16 : 0);
    this.ensureSpace(Math.min(blockHeight, 180));
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - blockHeight,
      width: CONTENT_WIDTH,
      height: blockHeight,
      color: COLORS.codeBackground,
      borderColor: COLORS.line,
      borderWidth: 0.5,
    });
    let cursor = top - padding - size;
    if (note) {
      this.page.drawText(sanitize(note), {
        x: MARGIN + padding,
        y: cursor,
        size: 8,
        font: this.fonts.bold,
        color: COLORS.primary,
      });
      cursor -= 14;
    }
    for (const line of wrappedLines) {
      this.page.drawText(sanitize(line), {
        x: MARGIN + padding,
        y: cursor,
        size,
        font: this.fonts.mono,
        color: COLORS.ink,
      });
      cursor -= lineHeight;
    }
    this.y = top - blockHeight - 8;
  }

  drawTable(rows: string[][]) {
    if (!rows.length) return;
    const size = 9;
    const padding = 6;
    const columns = Math.max(...rows.map((row) => row.length));
    const columnWidth = CONTENT_WIDTH / columns;
    const lineHeight = size * 1.4;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!;
      const cells = Array.from({ length: columns }, (_, index) => {
        const value = row[index] ?? "";
        return wrapRuns(
          [{ text: value, font: rowIndex === 0 ? "bold" : "regular" }],
          this.fonts,
          size,
          columnWidth - padding * 2,
        ).map((runs) => runs.map((run) => run.text).join(""));
      });
      const rowHeight = Math.max(...cells.map((lines) => lines.length)) * lineHeight + padding * 2;
      this.ensureSpace(rowHeight);
      const top = this.y;
      for (let column = 0; column < columns; column += 1) {
        const x = MARGIN + column * columnWidth;
        this.page.drawLine({
          start: { x, y: top },
          end: { x, y: top - rowHeight },
          thickness: 0.5,
          color: COLORS.line,
        });
        const lines = cells[column]!;
        lines.forEach((line, lineIndex) => {
          this.page.drawText(sanitize(line), {
            x: x + padding,
            y: top - padding - size - lineIndex * lineHeight,
            size,
            font: rowIndex === 0 ? this.fonts.bold : this.fonts.regular,
            color: COLORS.ink,
          });
        });
      }
      this.page.drawLine({
        start: { x: MARGIN, y: top - rowHeight },
        end: { x: PAGE_WIDTH - MARGIN, y: top - rowHeight },
        thickness: 0.5,
        color: COLORS.line,
      });
      this.page.drawLine({
        start: { x: PAGE_WIDTH - MARGIN, y: top },
        end: { x: PAGE_WIDTH - MARGIN, y: top - rowHeight },
        thickness: 0.5,
        color: COLORS.line,
      });
      this.y = top - rowHeight;
    }
  }

  drawWatermark(status: string) {
    const label = STATUS_LABEL[status] ?? status;
    if (status === "APPROVED") return;
    for (const page of this.pages) {
      page.drawText(sanitize(label), {
        x: 120,
        y: 330,
        size: 72,
        font: this.fonts.bold,
        color: COLORS.watermark,
        rotate: degrees(40),
      });
    }
  }
}

function wrapRuns(
  runs: readonly InlineRun[],
  fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont },
  size: number,
  maxWidth: number,
): InlineRun[][] {
  const pick = (font: InlineRun["font"]) =>
    font === "bold"
      ? fonts.bold
      : font === "italic"
        ? fonts.italic
        : font === "mono"
          ? fonts.mono
          : fonts.regular;
  const lines: InlineRun[][] = [];
  let current: InlineRun[] = [];
  let width = 0;

  const pushLine = () => {
    lines.push(current);
    current = [];
    width = 0;
  };

  for (const run of runs) {
    const pieces = sanitize(run.text)
      .split(/(\s+)/)
      .filter((piece) => piece.length > 0);
    for (const piece of pieces) {
      const pieceWidth = pick(run.font).widthOfTextAtSize(piece, size);
      if (width + pieceWidth > maxWidth && current.length > 0) {
        pushLine();
        if (/^\s+$/.test(piece)) continue;
      }
      current.push({ text: piece, font: run.font });
      width += pieceWidth;
    }
  }
  if (current.length > 0 || lines.length === 0) lines.push(current);
  return lines;
}

function runsFromInline(children: readonly InlineToken[] | null | undefined): InlineRun[] {
  const runs: InlineRun[] = [];
  let font: InlineRun["font"] = "regular";
  for (const child of children ?? []) {
    if (child.type === "strong_open") font = "bold";
    else if (child.type === "em_open") font = "italic";
    else if (child.type === "strong_close" || child.type === "em_close") font = "regular";
    else if (child.type === "code_inline") runs.push({ text: child.content ?? "", font: "mono" });
    else if (child.type === "softbreak") runs.push({ text: " ", font });
    else if (child.type === "hardbreak") runs.push({ text: "\n", font });
    else if (child.type === "text") runs.push({ text: child.content ?? "", font });
  }
  return runs;
}

function addPageNumbers(doc: PDFDocument, pages: PDFPage[], font: PDFFont, meta: string) {
  pages.forEach((page, index) => {
    const label = sanitize(`${meta} · Halaman ${index + 1}/${pages.length}`);
    const width = font.widthOfTextAtSize(label, 8);
    page.drawText(label, {
      x: PAGE_WIDTH - MARGIN - width,
      y: 28,
      size: 8,
      font,
      color: COLORS.muted,
    });
  });
}

export async function renderBrdPdf(input: BrdPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setProducer("Halodocs");
  doc.setCreationDate(input.updatedAt);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const writer = new PdfWriter(doc, fonts);

  writer.drawRuns([{ text: input.title, font: "bold" }], 20);
  const meta = `v${input.version} · ${STATUS_LABEL[input.status] ?? input.status} · ${input.updatedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  writer.drawRuns([{ text: meta, font: "regular" }], 9);
  writer.moveDown(6);
  writer.drawRule();

  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const tokens = md.parse(input.contentMarkdown.replace(/\r\n/g, "\n"), {});
  const listStack: Array<{ ordered: boolean; index: number }> = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableRow: string[] = [];
  let blockquoteDepth = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    switch (token.type) {
      case "heading_open": {
        const level = Number(token.tag.replace("h", ""));
        const inline = tokens[index + 1];
        const size = level <= 1 ? 18 : level === 2 ? 14 : level === 3 ? 12 : 10.5;
        writer.moveDown(level <= 2 ? 8 : 5);
        writer.ensureSpace(size * 2);
        if (level === 2) {
          writer.drawRuns([{ text: " ", font: "regular" }], 2);
        }
        writer.drawRuns(runsFromInline(inline?.children), size);
        writer.moveDown(2);
        if (level <= 2) writer.drawRule();
        break;
      }
      case "paragraph_open": {
        const inline = tokens[index + 1];
        const runs = runsFromInline(inline?.children);
        if (blockquoteDepth > 0) runs.unshift({ text: "│ ", font: "italic" });
        writer.drawRuns(runs, 10, blockquoteDepth * 14);
        writer.moveDown(4);
        break;
      }
      case "blockquote_open":
        blockquoteDepth += 1;
        break;
      case "blockquote_close":
        blockquoteDepth = Math.max(0, blockquoteDepth - 1);
        break;
      case "bullet_list_open":
        listStack.push({ ordered: false, index: 0 });
        break;
      case "ordered_list_open":
        listStack.push({ ordered: true, index: Number(token.attrGet("start") ?? 1) });
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        listStack.pop();
        writer.moveDown(2);
        break;
      case "list_item_open": {
        const list = listStack[listStack.length - 1];
        const marker = list?.ordered ? `${list.index}. ` : "• ";
        if (list) list.index += 1;
        writer.drawRuns([{ text: " ".repeat(listStack.length - 1) + marker, font: "regular" }], 10);
        break;
      }
      case "fence": {
        const language = (token.info ?? "").trim().toLowerCase();
        const isMermaid = language.startsWith("mermaid");
        const lines = token.content.replace(/\n$/, "").split("\n");
        writer.moveDown(4);
        writer.drawCodeBlock(
          lines,
          isMermaid ? "Diagram Mermaid - lihat versi interaktif di panel BRD" : undefined,
        );
        break;
      }
      case "table_open":
        inTable = true;
        tableRows = [];
        break;
      case "tr_open":
        tableRow = [];
        break;
      case "inline":
        if (inTable) {
          tableRow.push((token.content ?? "").trim());
        }
        break;
      case "tr_close":
        tableRows.push(tableRow);
        tableRow = [];
        break;
      case "table_close":
        inTable = false;
        writer.moveDown(4);
        writer.drawTable(tableRows);
        writer.moveDown(4);
        break;
      case "hr":
        writer.drawRule();
        break;
      default:
        break;
    }
  }

  writer.drawWatermark(input.status);
  addPageNumbers(doc, writer.pages, fonts.regular, `${input.title} · v${input.version}`);
  return doc.save();
}
