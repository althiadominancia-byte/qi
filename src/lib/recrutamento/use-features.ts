import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { resolveFeatures, hasFeature, type FeatureKey } from "@/lib/recrutamento/features";

/**
 * Entitlements efetivos da EMPRESA ATIVA.
 * - Papéis de empresa: herdam do scope (própria empresa).
 * - super_admin impersonando (?empresa=): busca da empresa aberta via RPC.
 * - Enquanto carrega ou sem contexto de empresa => permissivo (não esconde por engano).
 *
 * `has(feature)` é o gate a usar na UI: `has("diversidade")`, etc.
 */
export function useFeatures() {
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";

  const location = useLocation();
  const empresaParam = (location.search as any)?.empresa as string | undefined;
  const impersonando = !!isSuper && !!empresaParam;

  const featQ = useQuery({
    queryKey: ["empresa-features", empresaParam],
    enabled: impersonando,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_empresa_features" as any, { p_empresa_id: empresaParam! });
      return resolveFeatures((data ?? null) as any, null);
    },
  });

  const features: Record<string, boolean> | null = impersonando
    ? (featQ.data ?? null)
    : (scope?.features ?? null);

  return {
    features,
    has: (key: FeatureKey) => hasFeature(features, key),
  };
}
