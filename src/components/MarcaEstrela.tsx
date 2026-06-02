import { ROXO, LARANJA } from "@/lib/recrutamento/data";

export function MarcaEstrela({ size = 40, branca = false }: { size?: number; branca?: boolean }) {
  const c = branca ? "#FFFFFF" : ROXO;
  const acc = branca ? "#FFFFFF" : LARANJA;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M48 6 C48 28 28 48 6 48 C6 26 26 6 48 6 Z" fill={acc} />
      <path d="M52 6 C52 28 72 48 94 48 C94 26 74 6 52 6 Z" fill={c} />
      <path d="M48 94 C48 72 28 52 6 52 C6 74 26 94 48 94 Z" fill={c} />
      <path d="M52 94 C52 72 72 52 94 52 C94 74 74 94 52 94 Z" fill={c} />
    </svg>
  );
}
