import { useRef, useState, type PointerEvent } from "react";
import { Check, Move, RotateCcw, Upload } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import {
  profileImageCatalog,
  type ProfileImageKind,
  type ProfileImageSelection,
} from "./profile-image-catalog";
import "./profile-image-picker.css";

export function ProfileImagePicker({
  kind,
  current,
  onClose,
  onApply,
}: {
  kind: ProfileImageKind;
  current: ProfileImageSelection | null;
  onClose: () => void;
  onApply: (image: ProfileImageSelection) => void;
}) {
  const [src, setSrc] = useState(
    current?.original ?? profileImageCatalog[kind][0].src,
  );
  const [zoom, setZoom] = useState(current?.zoom ?? 1);
  const [x, setX] = useState(current?.x ?? 50);
  const [y, setY] = useState(current?.y ?? 50);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const readRequest = useRef(0);
  const aspect = kind === "photo" ? 1 : 5;
  const ratio = dimensions.width / (dimensions.height || 1);
  const width = Math.max(1, ratio / aspect) * zoom;
  const height = Math.max(1, aspect / (ratio || aspect)) * zoom;
  function reset() {
    setZoom(1);
    setX(50);
    setY(50);
  }
  function select(next: string) {
    readRequest.current++;
    setSrc(next);
    setDimensions({ width: 0, height: 0 });
    setError("");
    reset();
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (width > 1)
      setX(
        Math.max(
          0,
          Math.min(
            100,
            drag.current.startX -
              ((event.clientX - drag.current.x) / (box.width * (width - 1))) *
                100,
          ),
        ),
      );
    if (height > 1)
      setY(
        Math.max(
          0,
          Math.min(
            100,
            drag.current.startY -
              ((event.clientY - drag.current.y) / (box.height * (height - 1))) *
                100,
          ),
        ),
      );
  }
  function apply() {
    if (!image.current || !dimensions.width || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = kind === "photo" ? 512 : 1800;
      canvas.height = kind === "photo" ? 512 : 360;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen.");
      const cropWidth = dimensions.width / width;
      const cropHeight = dimensions.height / height;
      context.drawImage(
        image.current,
        ((dimensions.width - cropWidth) * x) / 100,
        ((dimensions.height - cropHeight) * y) / 100,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      onApply({
        original: src,
        preview: canvas.toDataURL("image/png"),
        zoom,
        x,
        y,
      });
      onClose();
    } catch {
      setError("No se pudo preparar la imagen. Prueba con otra foto.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={kind === "photo" ? "Elige tu foto de perfil" : "Elige tu banner"}
      description="Elige una imagen del estudio o sube la tuya y ajusta el encuadre."
      className="profile-image-sheet"
    >
      <div className="image-picker-layout">
        <div className="image-picker-gallery">
          <h3>Galería VEXA</h3>
          <div className={`image-picker-options image-picker-options-${kind}`}>
            {profileImageCatalog[kind].map((item) => (
              <button
                key={item.src}
                type="button"
                aria-pressed={src === item.src}
                onClick={() => select(item.src)}
              >
                <img src={item.src} alt="" />
                <span>{item.name}</span>
                {src === item.src && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => input.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Subir mi {kind === "photo" ? "foto" : "banner"}
          </Button>
          <p>JPG, PNG o WebP · hasta {kind === "photo" ? "5" : "10"} MB</p>
          <input
            ref={input}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label="Subir imagen personalizada"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > (kind === "photo" ? 5 : 10) * 1024 * 1024
              ) {
                setError(
                  "Elige una imagen JPG, PNG o WebP dentro del tamaño permitido.",
                );
                return;
              }
              const request = ++readRequest.current;
              const reader = new FileReader();
              reader.onload = () => {
                if (
                  request === readRequest.current &&
                  typeof reader.result === "string"
                )
                  select(reader.result);
              };
              reader.onerror = () => {
                if (request === readRequest.current)
                  setError("No se pudo leer el archivo.");
              };
              reader.readAsDataURL(file);
            }}
          />
        </div>
        <div className="image-picker-editor">
          <h3>Acomodar imagen</h3>
          <div
            className={`image-picker-frame image-picker-frame-${kind}`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                startX: x,
                startY: y,
              };
            }}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img
              key={src}
              ref={image}
              src={src}
              alt="Previsualización del encuadre"
              draggable={false}
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => {
                setDimensions({ width: 0, height: 0 });
                setError("No se pudo abrir esta imagen. Selecciona otra.");
              }}
              style={{
                width: `${width * 100}%`,
                height: `${height * 100}%`,
                left: `${-(width - 1) * x}%`,
                top: `${-(height - 1) * y}%`,
              }}
            />
          </div>
          <p className="image-picker-drag-hint">
            <Move size={14} aria-hidden="true" />
            Arrastra la imagen o usa los controles.
          </p>
          <label className="image-picker-control">
            Zoom <output>{zoom.toFixed(1)}×</output>
            <input
              type="range"
              min="1"
              max="3"
              step=".05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label className="image-picker-control">
            Posición horizontal
            <input
              type="range"
              min="0"
              max="100"
              value={x}
              disabled={width <= 1}
              onChange={(event) => setX(Number(event.target.value))}
            />
          </label>
          <label className="image-picker-control">
            Posición vertical
            <input
              type="range"
              min="0"
              max="100"
              value={y}
              disabled={height <= 1}
              onChange={(event) => setY(Number(event.target.value))}
            />
          </label>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" />
            Restablecer encuadre
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="image-picker-footer">
        <p>Vista previa; todavía no se guarda en tu cuenta.</p>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!dimensions.width || busy} onClick={apply}>
          Aplicar {kind === "photo" ? "foto" : "banner"}
        </Button>
      </div>
    </Sheet>
  );
}
