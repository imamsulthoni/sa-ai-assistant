import { useMemo } from "react";
import {
  useFieldArray,
  useForm,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import { Alert } from "#/components/base/alert";
import { Button } from "#/components/base/button";
import { Input, Textarea } from "#/components/base/input";

export type TemplateBuilderSectionValues = {
  id: string;
  title: string;
  required: boolean;
  purpose: string;
  expectedFormat: string;
  example: string;
};

export type TemplateBuilderValues = {
  templateName: string;
  description: string;
  language: string;
  acceptanceStyle: string;
  idConventions: string;
  sections: TemplateBuilderSectionValues[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function slugifySectionId(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "section"
  );
}

/** Prefill builder dari `templateStructure` hasil ekstraksi/manual sebelumnya. */
export function structureToFormValues(value: unknown): TemplateBuilderValues {
  const record = asRecord(value);
  const metadata = asRecord(record.metadata);
  const rawSections = Array.isArray(record.sections) ? record.sections : [];
  const ordered = rawSections
    .map((item, index) => ({ section: asRecord(item), index }))
    .sort((a, b) => {
      const orderA = typeof a.section.order === "number" ? a.section.order : a.index;
      const orderB = typeof b.section.order === "number" ? b.section.order : b.index;
      return orderA - orderB;
    });
  const sections = ordered.map(({ section }, index) => {
    const title = asText(section.title);
    return {
      id: asText(section.id) || slugifySectionId(title || `section_${index + 1}`),
      title,
      required: section.required === true,
      purpose: asText(section.purpose),
      expectedFormat: asText(section.expectedFormat),
      example: asText(section.example),
    };
  });
  return {
    templateName: asText(metadata.templateName) || "Template BRD Manual",
    description: asText(metadata.description),
    language: asText(record.language) || "id",
    acceptanceStyle: asText(record.acceptanceStyle),
    idConventions: (Array.isArray(record.idConventions) ? record.idConventions : [])
      .map((item) => asText(item))
      .filter(Boolean)
      .join(", "),
    sections,
  };
}

const clean = (value: string): string | null => (value.trim() ? value.trim() : null);

/** Bentuk ulang values menjadi JSON schema yang diterima `normalizeTemplateStructure`. */
export function formValuesToStructure(values: TemplateBuilderValues): Record<string, unknown> {
  return {
    sections: values.sections.map((section, index) => ({
      id: section.id.trim() || slugifySectionId(section.title),
      title: section.title.trim(),
      required: section.required,
      purpose: clean(section.purpose),
      expectedFormat: clean(section.expectedFormat),
      example: clean(section.example),
      order: index,
    })),
    idConventions: values.idConventions
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    language: clean(values.language),
    acceptanceStyle: clean(values.acceptanceStyle),
    metadata: {
      templateName: values.templateName.trim() || "Template BRD Manual",
      description: clean(values.description),
      sourceFormat: "manual",
    },
  };
}

function emptySection(index: number): TemplateBuilderSectionValues {
  return {
    id: `section_${index + 1}`,
    title: "",
    required: true,
    purpose: "",
    expectedFormat: "",
    example: "",
  };
}

const DEFAULT_VALUES: TemplateBuilderValues = {
  templateName: "Template BRD Manual",
  description: "",
  language: "id",
  acceptanceStyle: "",
  idConventions: "BR-###, FR-###",
  sections: [
    {
      id: "latar_belakang",
      title: "Latar Belakang & Tujuan",
      required: true,
      purpose: "Konteks bisnis dan tujuan inisiatif.",
      expectedFormat: "Naratif singkat",
      example: "",
    },
    {
      id: "ruang_lingkup",
      title: "Ruang Lingkup",
      required: true,
      purpose: "Batas in-scope dan out-of-scope.",
      expectedFormat: "Daftar bullet",
      example: "",
    },
  ],
};

type TemplateBuilderProps = {
  initialStructure?: unknown;
  busy?: boolean;
  onCancel: () => void;
  onSave: (values: { title: string; templateStructure: unknown }) => Promise<void>;
};

export function TemplateBuilder({ initialStructure, busy, onCancel, onSave }: TemplateBuilderProps) {
  const defaultValues = useMemo(
    () =>
      initialStructure ? structureToFormValues(initialStructure) : DEFAULT_VALUES,
    [initialStructure],
  );

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<TemplateBuilderValues>({ defaultValues, mode: "onSubmit" });

  const { fields, append, remove, move } = useFieldArray({ control, name: "sections" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((field) => field.id === active.id);
    const to = fields.findIndex((field) => field.id === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const submit = handleSubmit(async (values) => {
    await onSave({
      title: values.templateName.trim() || "Template BRD Manual",
      templateStructure: formValuesToStructure(values),
    });
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-foreground uppercase">
            Susun Struktur Manual
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Isi tiap field, tambah section sesuai kebutuhan, lalu atur urutannya dengan drag
            &amp; drop.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          <X size={12} /> Batal
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
            Nama template
          </span>
          <Input
            {...register("templateName", { required: "Nama template wajib diisi." })}
            placeholder="mis. Template BRD Standar"
          />
          {errors.templateName && (
            <span className="mt-1 block text-[11px] text-destructive">
              {errors.templateName.message}
            </span>
          )}
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
            Deskripsi
          </span>
          <Textarea
            {...register("description")}
            rows={2}
            placeholder="1 kalimat tentang ciri struktur template ini."
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
            Bahasa
          </span>
          <Input {...register("language")} placeholder="id" />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
            Gaya acceptance criteria
          </span>
          <Input {...register("acceptanceStyle")} placeholder="mis. Given/When/Then" />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
            Konvensi ID (pisahkan dengan koma)
          </span>
          <Input {...register("idConventions")} placeholder="BR-###, FR-###" />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Section ({fields.length})
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptySection(fields.length))}
          >
            <Plus size={12} /> Tambah section
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
            <AlertCircle size={12} /> Minimal satu section diperlukan.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <SortableSection
                  key={field.id}
                  id={field.id}
                  index={index}
                  register={register}
                  getValues={getValues}
                  setValue={setValue}
                  onRemove={() => remove(index)}
                  canRemove={fields.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {fields.length === 0 && (
        <Alert tone="warning">Tambahkan minimal satu section sebelum menyimpan.</Alert>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || fields.length === 0}>
          <Save size={13} /> {busy ? "Menyimpan…" : "Simpan struktur"}
        </Button>
      </div>
    </form>
  );
}

function SortableSection({
  id,
  index,
  register,
  getValues,
  setValue,
  onRemove,
  canRemove,
}: {
  id: string;
  index: number;
  register: UseFormRegister<TemplateBuilderValues>;
  getValues: UseFormGetValues<TemplateBuilderValues>;
  setValue: UseFormSetValue<TemplateBuilderValues>;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const titleField = register(`sections.${index}.title`, { required: true });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-muted p-3 ${
        isDragging ? "relative z-10 shadow-lg ring-1 ring-ring" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Geser section ${index + 1}`}
          className="grid size-6 shrink-0 cursor-grab place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">#{index + 1}</span>
        <Input
          {...titleField}
          onBlur={(event) => {
            titleField.onBlur(event);
            const currentId = getValues(`sections.${index}.id`);
            if (!currentId?.trim() && event.target.value.trim()) {
              setValue(`sections.${index}.id`, slugifySectionId(event.target.value));
            }
          }}
          placeholder="Nama section (mis. Ruang Lingkup)"
          className="h-8 flex-1"
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-muted-foreground">
          <input type="checkbox" {...register(`sections.${index}.required`)} className="size-3.5" />
          Wajib
        </label>
        <button
          type="button"
          aria-label={`Hapus section ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">
            ID section
          </span>
          <Input
            {...register(`sections.${index}.id`)}
            placeholder={slugifySectionId(getValues(`sections.${index}.title`) || "section")}
            className="h-8 font-mono text-[11px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">
            Format penyajian
          </span>
          <Input
            {...register(`sections.${index}.expectedFormat`)}
            placeholder="bullet / tabel / Given-When-Then / mermaid"
            className="h-8"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">
            Tujuan section
          </span>
          <Textarea
            {...register(`sections.${index}.purpose`)}
            rows={2}
            placeholder="Jenis informasi yang harus dimuat section ini."
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">
            Contoh pola (opsional)
          </span>
          <Textarea
            {...register(`sections.${index}.example`)}
            rows={2}
            placeholder="Placeholder generik, mis. [Aktor] melakukan [Aksi]."
          />
        </label>
      </div>
    </div>
  );
}