// Helpers para validar e comprimir o currículo antes do upload.
// Tudo roda no navegador do candidato.

export const CV_MAX_ORIGINAL_MB = 15;   // limite do que o candidato pode escolher
export const CV_MAX_FINAL_MB = 4;       // limite depois de comprimir (rejeita maior)

const PDF_MIMES = ["application/pdf"];
const IMG_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const DOC_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type CvKind = "pdf" | "image" | "doc";

export function detectKind(file: File): CvKind | null {
  const mt = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (PDF_MIMES.includes(mt) || ext === "pdf") return "pdf";
  if (IMG_MIMES.includes(mt) || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) return "image";
  if (DOC_MIMES.includes(mt) || ["doc", "docx"].includes(ext)) return "doc";
  return null;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function compressImage(file: File, maxDim = 1600, quality = 0.75): Promise<File> {
  // HEIC/HEIF não é decodificado pelo <img> em muitos navegadores → manda como está.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "heic" || ext === "heif") return file;

  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Imagem inválida"));
    im.src = dataUrl;
  });

  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#fff"; // fundo branco (PNG transparente vira JPEG)
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao comprimir imagem"))), "image/jpeg", quality)
  );

  // Se a "compressão" deu maior que o original, mantém o original.
  if (blob.size >= file.size) return file;

  const novoNome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], novoNome, { type: "image/jpeg" });
}

export type CvPreparado = {
  arquivo: File;          // arquivo final (já comprimido se for imagem)
  kind: CvKind;
  nomeOriginal: string;
  tamanhoOriginal: number;
  tamanhoFinal: number;
  comprimido: boolean;
};

/** Valida tipo + tamanho e comprime imagens. Lança Error com mensagem amigável. */
export async function prepararCv(file: File): Promise<CvPreparado> {
  const kind = detectKind(file);
  if (!kind) {
    throw new Error("Formato não suportado. Envie PDF, imagem (JPG/PNG/WEBP) ou DOC/DOCX.");
  }
  if (file.size > CV_MAX_ORIGINAL_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (${fmtSize(file.size)}). O limite é ${CV_MAX_ORIGINAL_MB} MB.`);
  }

  let final: File = file;
  let comprimido = false;
  if (kind === "image") {
    try {
      const c = await compressImage(file);
      if (c.size < file.size) { final = c; comprimido = true; }
    } catch { /* mantém original */ }
  }

  if (final.size > CV_MAX_FINAL_MB * 1024 * 1024) {
    throw new Error(`Arquivo continua grande demais após compressão (${fmtSize(final.size)}). Tente um PDF mais leve ou uma foto menor.`);
  }

  return {
    arquivo: final, kind,
    nomeOriginal: file.name,
    tamanhoOriginal: file.size,
    tamanhoFinal: final.size,
    comprimido,
  };
}
