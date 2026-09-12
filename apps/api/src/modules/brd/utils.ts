export async function bodyOf(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  return (await c.req.json().catch(() => null)) as unknown;
}

export function simpleDiff(before: string, after: string): string {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const output = ["--- before", "+++ after"];
  for (let index = 0; index < Math.max(oldLines.length, newLines.length); index++) {
    if (oldLines[index] !== newLines[index]) {
      if (oldLines[index] !== undefined) output.push(`-${oldLines[index]}`);
      if (newLines[index] !== undefined) output.push(`+${newLines[index]}`);
    }
  }
  return output.join("\n");
}

export function filename(title: string, extension: string): string {
  return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "brd"}.${extension}`;
}

export function buildPdf(contentMarkdown: string): string {
  const lines = contentMarkdown
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((line) => {
      const clean = line.replace(/^#{1,6}\s*/, "").replace(/[*_`]/g, "");
      if (clean.length <= 92) return [clean];
      return clean.match(/.{1,92}(?:\s|$)/g)?.map((part) => part.trimEnd()) ?? [clean];
    });
  const pageSize = 48;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / pageSize)) },
    (_, index) => lines.slice(index * pageSize, (index + 1) * pageSize),
  );
  const escapePdf = (value: string) => value.replace(/[()\\]/g, "\\$&");
  const objects: string[] = [];
  const pageIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (const page of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "40 750 Td",
      ...page.flatMap((line, index) => [
        index === 0 ? `(${escapePdf(line)}) Tj` : `0 -15 Td (${escapePdf(line)}) Tj`,
      ]),
      "ET",
    ].join("\n");
    const contentId = objects.length + 1;
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    );
    const pageId = objects.length + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    pageIds.push(pageId);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
