import logoAsset from "@/assets/iso-estrela.png.asset.json";

// Logo da marca. Sem `src`, usa o iso da Estrela (marca padrão) e respeita o
// filtro `branca` para uso sobre fundos escuros. Com `src` (logo custom de uma
// empresa white-label), exibe a imagem como está — sem o invert, que só faz
// sentido para o iso monocromático padrão.
export function MarcaEstrela({
  size = 40,
  branca = false,
  src,
  alt = "Distribuidora Estrela",
}: {
  size?: number;
  branca?: boolean;
  src?: string | null;
  alt?: string;
}) {
  const custom = !!src;
  return (
    <img
      src={custom ? (src as string) : logoAsset.url}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: !custom && branca ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}
