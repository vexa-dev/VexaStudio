import { useRef, useState, type FormEvent } from "react";
import { CloudUpload, X, Check } from "lucide-react";
import type { Area, Profile } from "@vexa/domain/types";
import { todayLima } from "@vexa/domain/dates";
import { Field, TextareaField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { DatePicker } from "@/features/time/components/TimePickers";
import {
  compensationLabels,
  workModeLabels,
  engagementLabels,
  type LocalCollaborator,
} from "../team-model";
type Document = NonNullable<LocalCollaborator["documents"]>[number];
const areas = {
  technical: "Tecnología",
  management_finance: "Gestión y finanzas",
  commercial: "Comercial",
  design_marketing: "Diseño y marketing",
};
function DocumentUpload({
  kind,
  value,
  onChange,
  onBusy,
}: {
  kind: Document["kind"];
  value?: Document;
  onBusy: (busy: boolean) => void;
  onChange: (document?: Document) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [drag, setDrag] = useState(false);
  const label = kind === "cv" ? "CV" : "Contrato";
  function load(file?: File) {
    if (!file || reading) return;
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (
      !ext ||
      !["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"].includes(ext) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      setError("Adjunta un PDF, Word o imagen de hasta 2 MB.");
      return;
    }
    setReading(true);
    onBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        kind,
        name: file.name,
        data: String(reader.result),
        size: file.size,
      });
      setReading(false);
      onBusy(false);
    };
    reader.onerror = () => {
      setError("No se pudo leer el archivo. Intenta nuevamente.");
      setReading(false);
      onBusy(false);
    };
    reader.readAsDataURL(file);
  }
  return (
    <div className="team-document-field">
      <span>
        {label} <small>Opcional</small>
      </span>
      <div
        className={`team-document-upload ${drag ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length > 1)
            setError("Adjunta un solo archivo.");
          else load(e.dataTransfer.files[0]);
        }}
      >
        <button
          type="button"
          disabled={reading}
          onClick={() => input.current?.click()}
          aria-label={`Adjuntar ${label}`}
        >
          <CloudUpload size={23} strokeWidth={1.5} aria-hidden="true" />
          <span>
            <strong>
              {reading
                ? "Leyendo archivo…"
                : (value?.name ?? `Adjunta o arrastra el ${label}`)}
            </strong>
            <small>
              {value
                ? `${Math.ceil(value.size / 1024)} KB · Clic para cambiar`
                : "PDF, Word o imagen · Hasta 2 MB"}
            </small>
          </span>
        </button>
        {value && (
          <button
            type="button"
            disabled={reading}
            className="team-document-remove"
            aria-label={`Quitar ${label}`}
            onClick={() => onChange(undefined)}
          >
            <X size={16} />
          </button>
        )}
        <input
          ref={input}
          type="file"
          hidden
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          aria-label={`Seleccionar ${label}`}
          onChange={(e) => {
            load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function CollaboratorForm({
  profiles,
  existing,
  onSave,
}: {
  profiles: Profile[];
  existing: LocalCollaborator[];
  onSave: (profile: LocalCollaborator) => boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [area, setArea] = useState<Area>("technical");
  const [supervisor, setSupervisor] = useState("");
  const [workMode, setWorkMode] =
    useState<NonNullable<LocalCollaborator["workMode"]>>("remote");
  const [engagement, setEngagement] =
    useState<NonNullable<LocalCollaborator["engagement"]>>("collaborator");
  const [compensation, setCompensation] =
    useState<NonNullable<LocalCollaborator["compensation"]>>("fixed");
  const [frequency, setFrequency] = useState("monthly");
  const [currency, setCurrency] = useState("PEN");
  const [start, setStart] = useState(todayLima());
  const [end, setEnd] = useState("");
  const [indefinite, setIndefinite] = useState(false);
  const [cv, setCv] = useState<Document>();
  const [contract, setContract] = useState<Document>();
  const [cvBusy, setCvBusy] = useState(false);
  const [contractBusy, setContractBusy] = useState(false);
  const busy = cvBusy || contractBusy;
  const paid = compensation === "fixed" || compensation === "mixed";
  const commission = compensation === "commission" || compensation === "mixed";
  function validate(section?: number) {
    const controls =
      form.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input,textarea",
      ) ?? [];
    for (const control of controls) {
      const parent = control.closest("fieldset");
      if (section !== undefined && Number(parent?.dataset.step) !== section)
        continue;
      if (!control.checkValidity()) {
        setStep(Number(parent?.dataset.step ?? 0));
        requestAnimationFrame(() => control.reportValidity());
        return false;
      }
    }
    if (
      (section === undefined || section === 1) &&
      (!start || (!indefinite && (!end || end < start)))
    ) {
      setStep(1);
      setError(
        "Selecciona el término del contrato o activa «Sin fecha de término».",
      );
      return false;
    }
    return true;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (busy || !validate()) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim(),
      email = String(data.get("email")).trim().toLowerCase(),
      position = String(data.get("position")).trim();
    if (name.length < 2 || !position) {
      setStep(0);
      setError("Completa el nombre y el cargo.");
      return;
    }
    if (existing.some((p) => p.email.toLowerCase() === email)) {
      setStep(0);
      setError("Ya existe un colaborador con este correo.");
      return;
    }
    if (!start || (!indefinite && !end) || (!indefinite && end < start)) {
      setStep(1);
      setError(
        "Selecciona fechas válidas. El término debe ser igual o posterior al ingreso.",
      );
      return;
    }
    const amount = Number(data.get("amount")),
      rate = Number(data.get("rate"));
    if (
      (paid && (!Number.isFinite(amount) || amount <= 0)) ||
      (commission && (!Number.isFinite(rate) || rate <= 0 || rate > 100))
    ) {
      setStep(1);
      setError("Revisa el importe y el porcentaje de comisión.");
      return;
    }
    if (commission && !String(data.get("basis") ?? "").trim()) {
      setStep(1);
      setError("Indica sobre qué ingreso se calcula la comisión.");
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      name,
      email,
      role: "collaborator",
      area,
      weeklyHours: Number(data.get("hours")),
      active: true,
      access: "pending",
      phone: String(data.get("phone") ?? "").trim(),
      position,
      supervisorId: supervisor || undefined,
      startDate: start,
      endDate: indefinite ? undefined : end,
      workMode,
      engagement,
      compensation,
      amount: paid ? amount : undefined,
      currency: currency as "PEN" | "USD",
      paymentFrequency: paid
        ? (frequency as "monthly" | "weekly" | "project")
        : undefined,
      commissionRate: commission ? rate : undefined,
      commissionBasis: commission
        ? String(data.get("basis") ?? "").trim()
        : undefined,
      notes: String(data.get("notes") ?? "").trim(),
      documents: [cv, contract].filter((d): d is Document => Boolean(d)),
    });
  }
  return (
    <form ref={form} className="team-onboarding" onSubmit={submit} noValidate>
      <nav aria-label="Secciones del alta" className="team-onboarding-tabs">
        {["Datos personales", "Condiciones", "Documentos"].map(
          (label, index) => (
            <button
              type="button"
              key={label}
              aria-current={step === index ? "step" : undefined}
              onClick={() => {
                setStep(index);
                setError("");
              }}
            >
              <span>{step > index ? <Check size={12} /> : index + 1}</span>
              {label}
            </button>
          ),
        )}
      </nav>
      <fieldset data-step="0" hidden={step !== 0}>
        <legend className="sr-only">Datos personales y puesto</legend>
        <Field
          label="Nombre completo"
          name="name"
          required
          minLength={2}
          maxLength={100}
          placeholder="Nombre y apellidos"
        />
        <Field
          label="Correo de acceso"
          name="email"
          type="email"
          required
          maxLength={160}
          placeholder="correo@dominio.com"
        />
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          maxLength={30}
          placeholder="Número de contacto"
        />
        <Field
          label="Cargo"
          name="position"
          required
          maxLength={100}
          placeholder="Cargo o especialidad"
        />
        <ChoicePicker
          label="Área"
          value={area}
          onChange={(v) => setArea(v as Area)}
          options={Object.entries(areas).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <ChoicePicker
          label="Responsable"
          value={supervisor}
          onChange={setSupervisor}
          options={[
            { value: "", label: "Sin asignar" },
            ...profiles
              .filter((p) => p.active && p.role !== "collaborator")
              .map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </fieldset>
      <fieldset data-step="1" hidden={step !== 1}>
        <legend className="sr-only">Vínculo y remuneración</legend>
        <ChoicePicker
          label="Tipo de vínculo"
          value={engagement}
          onChange={(v) => {
            setEngagement(v as typeof engagement);
            if (v === "internship") setCompensation("unpaid");
          }}
          options={Object.entries(engagementLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <ChoicePicker
          label="Modalidad"
          value={workMode}
          onChange={(v) => setWorkMode(v as typeof workMode)}
          options={Object.entries(workModeLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <DatePicker
          label="Fecha de ingreso"
          value={start}
          onChange={setStart}
          allowClear={false}
        />
        {indefinite ? (
          <Field
            label="Término del contrato"
            value="Sin fecha de término"
            disabled
          />
        ) : (
          <DatePicker
            label="Término del contrato"
            value={end}
            onChange={setEnd}
            min={start}
          />
        )}
        <button
          type="button"
          role="switch"
          aria-checked={indefinite}
          className="team-indefinite team-form-wide"
          onClick={() => setIndefinite((v) => !v)}
        >
          <span>Sin fecha de término</span>
          <span className="team-switch-track" aria-hidden="true">
            <span />
          </span>
        </button>
        <Field
          label="Horas por semana"
          name="hours"
          type="number"
          min={1}
          max={60}
          step={1}
          required
          defaultValue={15}
        />
        <ChoicePicker
          label="Remuneración"
          value={compensation}
          onChange={(v) => setCompensation(v as typeof compensation)}
          options={Object.entries(compensationLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {paid && (
          <>
            <Field
              label="Importe acordado"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max="99999999"
              required
              placeholder="0.00"
            />
            <ChoicePicker
              label="Moneda"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "PEN", label: "PEN · Soles" },
                { value: "USD", label: "USD · Dólares" },
              ]}
            />
            <ChoicePicker
              label="Frecuencia de pago"
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: "monthly", label: "Mensual" },
                { value: "weekly", label: "Semanal" },
                { value: "project", label: "Por proyecto" },
              ]}
            />
          </>
        )}
        {commission && (
          <>
            <Field
              label="Comisión (%)"
              name="rate"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              required
              placeholder="Porcentaje"
            />
            <Field
              label="Base de la comisión"
              name="basis"
              required
              maxLength={200}
              placeholder="Sobre qué ingreso se calcula"
            />
          </>
        )}
        {compensation === "unpaid" && (
          <p className="team-caption team-form-wide">
            Sin remuneración económica registrada.
          </p>
        )}
      </fieldset>
      <fieldset data-step="2" hidden={step !== 2}>
        <legend className="sr-only">Documentos y observaciones</legend>
        <DocumentUpload
          kind="cv"
          value={cv}
          onChange={setCv}
          onBusy={setCvBusy}
        />
        <DocumentUpload
          kind="contract"
          value={contract}
          onChange={setContract}
          onBusy={setContractBusy}
        />
        <div className="team-form-wide">
          <TextareaField
            label="Observaciones"
            name="notes"
            maxLength={1500}
            placeholder="Acuerdos, objetivos o información adicional"
          />
        </div>
        <p className="team-caption team-form-wide">
          El perfil quedará con acceso pendiente de activación.
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <footer className="team-onboarding-footer">
        <span>Paso {step + 1} de 3</span>
        <div>
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(step - 1)}
            >
              Anterior
            </Button>
          )}
          {step < 2 ? (
            <Button
              key="continue"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                setError("");
                if (validate(step)) setStep(step + 1);
              }}
            >
              Continuar
            </Button>
          ) : (
            <Button key="save" type="submit" disabled={busy}>
              Registrar colaborador
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}
