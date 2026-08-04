// E-mail transacional via Resend (https://resend.com) — sem dependência nova,
// só a API HTTP. FAIL-GRACEFUL: sem RESEND_API_KEY configurada, loga e segue
// (o produto funciona; a notificação é reforço, nunca bloqueio).
//
// Env (ler DENTRO da função — no Cloudflare o env é por requisição):
//   RESEND_API_KEY  — chave da conta Resend
//   EMAIL_FROM      — remetente verificado (ex.: "Qinspira <avisos@dominio.com>")
//   PUBLIC_SITE_URL — base dos links (ex.: https://app.qinspira.com)

export function siteUrl(): string {
  return process.env.PUBLIC_SITE_URL || "http://localhost:5173";
}

export async function enviarEmail(opts: {
  para: string;
  assunto: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY ausente — notificação não enviada:", opts.assunto);
    return false;
  }
  const from = process.env.EMAIL_FROM || "Qinspira <onboarding@resend.dev>";
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.para], subject: opts.assunto, html: opts.html }),
    });
    if (!resp.ok) {
      console.error("[email] falha ao enviar:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] erro de rede:", e);
    return false;
  }
}

/** Layout mínimo, neutro e responsivo dos avisos do portal. */
export function templateAviso(opts: {
  titulo: string;
  corpo: string;
  ctaRotulo: string;
  ctaUrl: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f3fa;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:24px auto;background:#fff;border-radius:14px;padding:28px">
    <h1 style="font-size:19px;color:#241a3d;margin:0 0 12px">${opts.titulo}</h1>
    <p style="font-size:14px;color:#4b4560;line-height:1.6;margin:0 0 20px">${opts.corpo}</p>
    <a href="${opts.ctaUrl}" style="display:inline-block;background:#50328A;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px">${opts.ctaRotulo}</a>
    <p style="font-size:11px;color:#9b93b0;margin:22px 0 0">Você recebeu este aviso porque tem uma conta no portal do candidato. Os seus dados só são compartilhados com a empresa se você aceitar.</p>
  </div></body></html>`;
}
