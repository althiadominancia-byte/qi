// ============================================================================
// Dois PLANOS de permissão, propositalmente distintos:
//
//  1) USO DA APLICAÇÃO (este bloco — PERM_KEYS): operar o recrutamento DENTRO de
//     uma empresa (vagas, candidatos, catálogo...). É o que os papéis da empresa
//     (admin_empresa, recrutador, visualizador) recebem e o que a tela de
//     Permissões edita.
//  2) GESTÃO DO SAAS (SAAS_PERM_KEYS, mais abaixo): governar a PLATAFORMA acima
//     das empresas (criar/inativar tenants, unidades, usuários globais). Hoje
//     exclusivo do super_admin.
//
// A sidebar e o gating usam esses domínios para não misturar os dois planos.
// ============================================================================

export const PERM_KEYS = [
  "gerenciar_usuarios", "gerenciar_vagas", "encerrar_vagas",
  "ver_candidatos", "ver_curriculo", "ver_diversidade", "exportar",
  "gerenciar_catalogo", "conduzir_entrevistas",
] as const;

export type PermKey = typeof PERM_KEYS[number];
export type RoleKey = "super_admin" | "admin_empresa" | "recrutador" | "visualizador";

/** Alias explícito: PERM_KEYS é o domínio de USO DA APLICAÇÃO (por empresa). */
export const APP_PERM_KEYS = PERM_KEYS;

export const PERM_LABELS: Record<PermKey, { nome: string; desc: string }> = {
  gerenciar_usuarios: { nome: "Gerenciar usuários", desc: "Criar usuários e liberar permissões" },
  gerenciar_vagas: { nome: "Criar e editar vagas", desc: "Inclui gerar perfil com IA" },
  encerrar_vagas: { nome: "Encerrar / reabrir vagas", desc: "" },
  ver_candidatos: { nome: "Ver candidatos e match", desc: "" },
  ver_curriculo: { nome: "Ver análise de currículo", desc: "" },
  ver_diversidade: { nome: "Ver diversidade (agregado)", desc: "" },
  exportar: { nome: "Exportar dados", desc: "" },
  gerenciar_catalogo: { nome: "Gerenciar departamentos / setores", desc: "Catálogo da empresa" },
  conduzir_entrevistas: { nome: "Conduzir entrevistas", desc: "Abrir salas de vídeo e ver a análise da entrevista" },
};

export const ROLES: Record<RoleKey, { nome: string; cor: string; desc: string }> = {
  super_admin: { nome: "Super Admin", cor: "#50328A", desc: "Acesso total à plataforma. Cria empresas, usuários e libera permissões." },
  admin_empresa: { nome: "Admin da Empresa", cor: "#2E8B7A", desc: "Gestor de uma empresa. Vê todas as unidades dela." },
  recrutador: { nome: "Recrutador", cor: "#EB5717", desc: "Trabalha as vagas e candidatos das unidades liberadas." },
  visualizador: { nome: "Visualizador", cor: "#3B6FB0", desc: "Apenas leitura de candidatos e análises." },
};
export const ORDEM_ROLES: RoleKey[] = ["super_admin", "admin_empresa", "recrutador", "visualizador"];
export const ROLES_EDITAVEIS: Exclude<RoleKey, "super_admin">[] = ["admin_empresa", "recrutador", "visualizador"];

export const PRESET: Record<RoleKey, Record<PermKey, boolean>> = {
  super_admin:  { gerenciar_usuarios: true,  gerenciar_vagas: true,  encerrar_vagas: true,  ver_candidatos: true, ver_curriculo: true, ver_diversidade: true,  exportar: true,  gerenciar_catalogo: true,  conduzir_entrevistas: true  },
  admin_empresa:{ gerenciar_usuarios: true,  gerenciar_vagas: true,  encerrar_vagas: true,  ver_candidatos: true, ver_curriculo: true, ver_diversidade: true,  exportar: true,  gerenciar_catalogo: true,  conduzir_entrevistas: true  },
  recrutador:   { gerenciar_usuarios: false, gerenciar_vagas: true,  encerrar_vagas: true,  ver_candidatos: true, ver_curriculo: true, ver_diversidade: true,  exportar: false, gerenciar_catalogo: false, conduzir_entrevistas: true  },
  visualizador: { gerenciar_usuarios: false, gerenciar_vagas: false, encerrar_vagas: false, ver_candidatos: true, ver_curriculo: true, ver_diversidade: false, exportar: false, gerenciar_catalogo: false, conduzir_entrevistas: false },
};

export function hasPerm(perms: Record<string, boolean> | null | undefined, key: PermKey, role?: RoleKey) {
  if (role === "super_admin") return true;
  return !!(perms && perms[key]);
}

/* ============ Domínio de GESTÃO DO SAAS (plano da plataforma) ============ */
// Governança da plataforma, acima das empresas. Distinto de PERM_KEYS (uso da
// aplicação). Hoje todas implícitas ao super_admin; modeladas como domínio
// próprio para o sidebar/gating tratarem os dois planos separadamente e para
// permitir granularização futura (ex.: papéis de staff da plataforma).
export const SAAS_PERM_KEYS = [
  "gerenciar_empresas", "gerenciar_unidades", "gerenciar_usuarios_globais",
] as const;
export type SaasPermKey = typeof SAAS_PERM_KEYS[number];

export const SAAS_PERM_LABELS: Record<SaasPermKey, { nome: string; desc: string }> = {
  gerenciar_empresas: { nome: "Empresas (tenants)", desc: "Criar, inativar e configurar empresas da plataforma" },
  gerenciar_unidades: { nome: "Unidades", desc: "Matriz e filiais de cada empresa" },
  gerenciar_usuarios_globais: { nome: "Usuários globais", desc: "Gerir usuários de qualquer empresa e conceder super admin" },
};

/** Plano de gestão do SaaS. Hoje = super_admin. */
export function isSaasAdmin(role?: RoleKey | null): boolean {
  return role === "super_admin";
}
/** Permissão do plano de gestão do SaaS (todas implícitas ao super_admin). */
export function hasSaasPerm(role: RoleKey | null | undefined, _key: SaasPermKey): boolean {
  return isSaasAdmin(role);
}

/** Resolve permissão efetiva: super_admin → tudo; override do usuário vence; senão padrão do papel da empresa. */
export function resolveEfetivas(
  role: RoleKey,
  override: Record<string, boolean> | null | undefined,
  padraoEmpresa: Record<string, boolean> | null | undefined,
): Record<PermKey, boolean> {
  if (role === "super_admin") return { ...PRESET.super_admin };
  const base = padraoEmpresa && Object.keys(padraoEmpresa).length ? padraoEmpresa : PRESET[role];
  const out = {} as Record<PermKey, boolean>;
  for (const k of PERM_KEYS) {
    out[k] = override && k in override ? !!override[k] : !!base[k];
  }
  return out;
}
