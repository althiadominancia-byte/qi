import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

// Sala de vídeo (LiveKit). Default export + carregada via React.lazy para o
// livekit-client (APIs de browser) nunca rodar no SSR. Recebe url+token já
// emitidos pelo servidor; `onSair` fecha a sala.
export default function SalaVideo({ url, token, onSair }: { url: string; token: string; onSair: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0b0b12" }}>
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio
        video
        onDisconnected={onSair}
        style={{ height: "100dvh" }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
