import { createFileRoute } from "@tanstack/react-router";

// Cron route: dispara avaliações de experiência vencidas.
// Auth: header `apikey` deve bater com a anon key do projeto (padrão pg_cron).
// Idempotente: só processa status='agendada' com data_prevista <= hoje.
export const Route = createFileRoute("/api/public/hooks/avaliacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("Apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const hoje = new Date().toISOString().slice(0, 10);

        const { data: pend, error } = await supabaseAdmin
          .from("avaliacoes_experiencia")
          .select("id, marco, data_prevista, token, contratacao_id, empresa_id, contratacoes:contratacao_id(nome, email, telefone, status, empresa_id)")
          .eq("status", "agendada")
          .lte("data_prevista", hoje)
          .limit(500);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        let enviadas = 0;
        for (const av of pend ?? []) {
          const contr: any = (av as any).contratacoes;
          if (!contr || contr.status !== "ativa") continue;
          // Só dispara se empresa ativa
          const { data: emp } = await supabaseAdmin.from("empresas").select("ativo").eq("id", contr.empresa_id).maybeSingle();
          if (!emp?.ativo) continue;

          // TODO: enviar e-mail/WhatsApp via provedor configurado.
          // Por enquanto apenas marca como enviada (idempotente pelo status).
          const { error: upErr } = await supabaseAdmin
            .from("avaliacoes_experiencia")
            .update({ status: "enviada", enviada_em: new Date().toISOString() })
            .eq("id", av.id)
            .eq("status", "agendada");
          if (!upErr) enviadas++;
        }

        return new Response(JSON.stringify({ ok: true, encontradas: pend?.length ?? 0, enviadas }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
