export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      candidatos_televendas: {
        Row: {
          celular: string
          created_at: string
          cv_analise: Json | null
          cv_nome_arquivo: string | null
          cv_storage_path: string | null
          disc_pontuacao: Json
          disc_respostas: Json
          email: string
          empresa_id: string | null
          endereco: string | null
          experiencia_texto: string | null
          id: string
          lgpd_aceite: boolean
          match_final: number | null
          match_label: string | null
          motivacao_texto: string | null
          nome: string
          perfil_key: string | null
          perfil_nome: string | null
          postura_score: number | null
          setor_atual: string | null
          situacionais: Json
          tempo_empresa: string | null
          unidade_id: string | null
          vaga_id: string | null
        }
        Insert: {
          celular: string
          created_at?: string
          cv_analise?: Json | null
          cv_nome_arquivo?: string | null
          cv_storage_path?: string | null
          disc_pontuacao?: Json
          disc_respostas?: Json
          email: string
          empresa_id?: string | null
          endereco?: string | null
          experiencia_texto?: string | null
          id?: string
          lgpd_aceite?: boolean
          match_final?: number | null
          match_label?: string | null
          motivacao_texto?: string | null
          nome: string
          perfil_key?: string | null
          perfil_nome?: string | null
          postura_score?: number | null
          setor_atual?: string | null
          situacionais?: Json
          tempo_empresa?: string | null
          unidade_id?: string | null
          vaga_id?: string | null
        }
        Update: {
          celular?: string
          created_at?: string
          cv_analise?: Json | null
          cv_nome_arquivo?: string | null
          cv_storage_path?: string | null
          disc_pontuacao?: Json
          disc_respostas?: Json
          email?: string
          empresa_id?: string | null
          endereco?: string | null
          experiencia_texto?: string | null
          id?: string
          lgpd_aceite?: boolean
          match_final?: number | null
          match_label?: string | null
          motivacao_texto?: string | null
          nome?: string
          perfil_key?: string | null
          perfil_nome?: string | null
          postura_score?: number | null
          setor_atual?: string | null
          situacionais?: Json
          tempo_empresa?: string | null
          unidade_id?: string | null
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_televendas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      diversidade_candidatos: {
        Row: {
          created_at: string
          empresa_id: string | null
          genero: string | null
          id: string
          orientacao: string | null
          pcd: string | null
          politico: string | null
          raca: string | null
          unidade_id: string | null
          vaga_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          genero?: string | null
          id?: string
          orientacao?: string | null
          pcd?: string | null
          politico?: string | null
          raca?: string | null
          unidade_id?: string | null
          vaga_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          genero?: string | null
          id?: string
          orientacao?: string | null
          pcd?: string | null
          politico?: string | null
          raca?: string | null
          unidade_id?: string | null
          vaga_id?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuario_unidades: {
        Row: {
          unidade_id: string
          usuario_id: string
        }
        Insert: {
          unidade_id: string
          usuario_id: string
        }
        Update: {
          unidade_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_unidades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          perms: Json
          role: Database["public"]["Enums"]["user_role"]
          todas_unidades: boolean
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          nome?: string
          perms?: Json
          role?: Database["public"]["Enums"]["user_role"]
          todas_unidades?: boolean
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          perms?: Json
          role?: Database["public"]["Enums"]["user_role"]
          todas_unidades?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vagas: {
        Row: {
          competencias: Json
          created_at: string
          created_by: string | null
          data_limite: string | null
          descricao: string
          empresa_id: string
          escolaridade: string
          experiencia: string
          habilidades: Json
          id: string
          link_token: string
          modelo: string
          pesos: Json
          requisitos: string
          setor: string
          status: string
          tipo: string
          titulo: string
          unidade_id: string
          updated_at: string
          usar_situacional: boolean
          vagas: number
        }
        Insert: {
          competencias?: Json
          created_at?: string
          created_by?: string | null
          data_limite?: string | null
          descricao?: string
          empresa_id: string
          escolaridade?: string
          experiencia?: string
          habilidades?: Json
          id?: string
          link_token?: string
          modelo?: string
          pesos?: Json
          requisitos?: string
          setor?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id: string
          updated_at?: string
          usar_situacional?: boolean
          vagas?: number
        }
        Update: {
          competencias?: Json
          created_at?: string
          created_by?: string | null
          data_limite?: string | null
          descricao?: string
          empresa_id?: string
          escolaridade?: string
          experiencia?: string
          habilidades?: Json
          id?: string
          link_token?: string
          modelo?: string
          pesos?: Json
          requisitos?: string
          setor?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string
          updated_at?: string
          usar_situacional?: boolean
          vagas?: number
        }
        Relationships: [
          {
            foreignKeyName: "vagas_unidade_fk"
            columns: ["empresa_id", "unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_empresa: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_recruiter: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_can_access_unidade: {
        Args: { _empresa: string; _unidade: string }
        Returns: boolean
      }
      user_has_perm: { Args: { _perm: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "recrutador"
      user_role: "super_admin" | "admin_empresa" | "recrutador" | "visualizador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "recrutador"],
      user_role: ["super_admin", "admin_empresa", "recrutador", "visualizador"],
    },
  },
} as const
