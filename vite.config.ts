// Config explícita (substitui @lovable.dev/vite-tanstack-config).
// Recria os plugins essenciais que o wrapper montava, sem os plugins de sandbox
// / error-logger específicos do Lovable:
//   - tailwindcss (v4), vite-tsconfig-paths (alias @/), tanstackStart (com o
//     importProtection server-only), nitro (target Cloudflare, só no build) e
//     @vitejs/plugin-react.
// O env VITE_* é exposto nativamente pelo Vite; o servidor lê process.env.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => {
  const plugins: any[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Impede import de código server-only no bundle do cliente (vira erro).
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Redireciona o entry SSR para src/server.ts (wrapper de erro do SSR).
      server: { entry: "server" },
    } as any),
  ];

  // nitro só no build de produção — target Cloudflare Workers.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: "cloudflare-module", cloudflare: { nodeCompat: true } } as any));
  }

  plugins.push(viteReact());

  return { plugins };
});
