export const PERM_KEYS = [
  "gerenciar_usuarios", "gerenciar_vagas", "encerrar_vagas",
  "ver_candidatos", "ver_curriculo", "ver_diversidade", "exportar",
] as const;

export type PermKey = typeof PERM_KEYS[number];
export type RoleKey = "super_admin" | "admin_empresa" | "recrutador" | "visualizador";

export const PERM_LABELS: Record<PermKey, { nome: string; desc: string }> = {
  gerenciar_usuarios: { nome: "Gerenciar usuários", desc: "Criar usuários e liberar permissões" },
  gerenciar_vagas: { nome: "Criar e editar vagas", desc: "Inclui gerar perfil com IA" },
  encerrar_vagas: { nome: "Encerrar / reabrir vagas", desc: "" },
  ver_candidatos: { nome: "Ver candidatos e match", desc: "" },
  ver_curriculo: { nome: "Ver análise de currículo", desc: "" },
  ver_diversidade: { nome: "Ver diversidade (agregado)", desc: "" },
  exportar: { nome: "Exportar dados", desc: "" },
};

export const ROLES: Record<RoleKey, { nome: string; cor: string; desc: string }> = {
  super_admin: { nome: "Super Admin", cor: "#50328A", desc: "Acesso total à plataforma. Cria empresas, usuários e libera permissões." },
  admin_empresa: { nome: "Admin da Empresa", cor: "#2E8B7A", desc: "Gestor de uma empresa. Vê todas as unidades dela." },
  recrutador: { nome: "Recrutador", cor: "#EB5717", desc: "Trabalha as vagas e candidatos das unidades liberadas." },
  visualizador: { nome: "Visualizador", cor: "#3B6FB0", desc: "Apenas leitura de candidatos e análises." },
};
export const ORDEM_ROLES: RoleKey[] = ["super_admin", "admin_empresa", "recrutador", "visualizador"];

export const PRESET: Record<RoleKey, Record<PermKey, boolean>> = {
  super_admin:  { gerenciar_usuarios: true,  gerenciar_vagas: true,  encerrar_vagas: true,  ver_candidatos: true, ver_curriculo: true, ver_diversidade: true,  exportar: true  },
  admin_empresa:{ gerenciar_usuarios: true,  gerenciar_vagas: true,  encerrar_vagas: true,  ver_candidatos: true, ver_curriculo: true, ver_diversidade: true,  exportar: true  },
  recrutador:   { gerenciar_usuarios: false, gerenciar_vagas: true,  encerrar_vagas: true,  ver_candidatos: true, ver_curriculo: true, ver_diversidade: true,  exportar: false },
  visualizador: { gerenciar_usuarios: false, gerenciar_vagas: false, encerrar_vagas: false, ver_candidatos: true, ver_curriculo: true, ver_diversidade: false, exportar: false },
};

export function hasPerm(perms: Record<string, boolean> | null | undefined, key: PermKey, role?: RoleKey) {
  if (role === "super_admin") return true;
  return !!(perms && perms[key]);
}
