import logoAsset from "@/assets/iso-estrela.png.asset.json";

export function MarcaEstrela({ size = 40, branca = false }: { size?: number; branca?: boolean }) {
  return (
    <img
      src={logoAsset.url}
      alt="Distribuidora Estrela"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: branca ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}
