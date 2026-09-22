export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          claim_id: number | null
          created_at: string
          created_by_system: boolean
          created_by_user: string | null
          error_code: string | null
          error_message: string | null
          executed_at: string | null
          external_result: Json | null
          id: string
          idempotency_key: string
          item_id: string | null
          kind: string
          meli_account_id: string
          order_id: number | null
          org_id: string
          pack_id: number | null
          payload_sanitized: Json
          policy_snapshot: Json
          rendered_text: string | null
          requires_approval: boolean
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          claim_id?: number | null
          created_at?: string
          created_by_system?: boolean
          created_by_user?: string | null
          error_code?: string | null
          error_message?: string | null
          executed_at?: string | null
          external_result?: Json | null
          id?: string
          idempotency_key: string
          item_id?: string | null
          kind: string
          meli_account_id: string
          order_id?: number | null
          org_id: string
          pack_id?: number | null
          payload_sanitized?: Json
          policy_snapshot?: Json
          rendered_text?: string | null
          requires_approval?: boolean
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          claim_id?: number | null
          created_at?: string
          created_by_system?: boolean
          created_by_user?: string | null
          error_code?: string | null
          error_message?: string | null
          executed_at?: string | null
          external_result?: Json | null
          id?: string
          idempotency_key?: string
          item_id?: string | null
          kind?: string
          meli_account_id?: string
          order_id?: number | null
          org_id?: string
          pack_id?: number | null
          payload_sanitized?: Json
          policy_snapshot?: Json
          rendered_text?: string | null
          requires_approval?: boolean
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_drafts_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_executions: {
        Row: {
          action_draft_id: string
          attempt: number
          correlation_id: string | null
          error_class: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          idempotency_key: string
          meli_account_id: string
          org_id: string
          outcome: string
          started_at: string
        }
        Insert: {
          action_draft_id: string
          attempt?: number
          correlation_id?: string | null
          error_class?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          idempotency_key: string
          meli_account_id: string
          org_id: string
          outcome?: string
          started_at?: string
        }
        Update: {
          action_draft_id?: string
          attempt?: number
          correlation_id?: string | null
          error_class?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string
          meli_account_id?: string
          org_id?: string
          outcome?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_executions_action_draft_id_fkey"
            columns: ["action_draft_id"]
            isOneToOne: false
            referencedRelation: "action_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_executions_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_classifications: {
        Row: {
          claim_risk: number | null
          created_at: string
          id: string
          intent: string
          labels: string[]
          meli_account_id: string
          model: string
          org_id: string
          output: Json
          provider: string
          sanitized_input_hash: string
          schema_version: string
          sentiment: number | null
          source_id: string
          source_type: string
          urgency: number | null
        }
        Insert: {
          claim_risk?: number | null
          created_at?: string
          id?: string
          intent: string
          labels?: string[]
          meli_account_id: string
          model: string
          org_id: string
          output: Json
          provider: string
          sanitized_input_hash: string
          schema_version: string
          sentiment?: number | null
          source_id: string
          source_type: string
          urgency?: number | null
        }
        Update: {
          claim_risk?: number | null
          created_at?: string
          id?: string
          intent?: string
          labels?: string[]
          meli_account_id?: string
          model?: string
          org_id?: string
          output?: Json
          provider?: string
          sanitized_input_hash?: string
          schema_version?: string
          sentiment?: number | null
          source_id?: string
          source_type?: string
          urgency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_classifications_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_classifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          body: string
          channels: Json
          created_at: string
          id: string
          kind: string
          meli_account_id: string | null
          org_id: string
          resolved_at: string | null
          resource_id: string | null
          resource_type: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body: string
          channels?: Json
          created_at?: string
          id?: string
          kind: string
          meli_account_id?: string | null
          org_id: string
          resolved_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity: string
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string
          channels?: Json
          created_at?: string
          id?: string
          kind?: string
          meli_account_id?: string | null
          org_id?: string
          resolved_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_messages: {
        Row: {
          claim_id: number
          classification_id: string | null
          date_created: string | null
          external_message_id: string
          id: string
          meli_account_id: string
          moderation_status: string | null
          org_id: string
          sender_role: string | null
          text_sanitized: string | null
        }
        Insert: {
          claim_id: number
          classification_id?: string | null
          date_created?: string | null
          external_message_id: string
          id?: string
          meli_account_id: string
          moderation_status?: string | null
          org_id: string
          sender_role?: string | null
          text_sanitized?: string | null
        }
        Update: {
          claim_id?: number
          classification_id?: string | null
          date_created?: string | null
          external_message_id?: string
          id?: string
          meli_account_id?: string
          moderation_status?: string | null
          org_id?: string
          sender_role?: string | null
          text_sanitized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_messages_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_reasons: {
        Row: {
          allowed_flows: string[]
          detail: string | null
          expected_resolutions: string[]
          flow: string | null
          groups: string[]
          last_synced_at: string
          name: string | null
          raw_sanitized: Json
          reason_id: string
          site_ids: string[]
          source_last_updated: string | null
          status: string | null
          triage_tags: string[]
        }
        Insert: {
          allowed_flows?: string[]
          detail?: string | null
          expected_resolutions?: string[]
          flow?: string | null
          groups?: string[]
          last_synced_at?: string
          name?: string | null
          raw_sanitized?: Json
          reason_id: string
          site_ids?: string[]
          source_last_updated?: string | null
          status?: string | null
          triage_tags?: string[]
        }
        Update: {
          allowed_flows?: string[]
          detail?: string | null
          expected_resolutions?: string[]
          flow?: string | null
          groups?: string[]
          last_synced_at?: string
          name?: string | null
          raw_sanitized?: Json
          reason_id?: string
          site_ids?: string[]
          source_last_updated?: string | null
          status?: string | null
          triage_tags?: string[]
        }
        Relationships: []
      }
      claims: {
        Row: {
          action_responsible: string | null
          affects_reputation: string | null
          available_actions: string[]
          claim_id: number
          date_created: string | null
          due_date: string | null
          fulfilled: boolean | null
          has_incentive: boolean | null
          last_synced_at: string
          meli_account_id: string
          order_id: number | null
          org_id: string
          pack_id: number | null
          problem_sanitized: string | null
          raw_sanitized: Json
          reason_id: string | null
          resolution_closed_by: string | null
          resolution_reason: string | null
          resource: string | null
          resource_id: number | null
          source_last_updated: string
          stage: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          action_responsible?: string | null
          affects_reputation?: string | null
          available_actions?: string[]
          claim_id: number
          date_created?: string | null
          due_date?: string | null
          fulfilled?: boolean | null
          has_incentive?: boolean | null
          last_synced_at?: string
          meli_account_id: string
          order_id?: number | null
          org_id: string
          pack_id?: number | null
          problem_sanitized?: string | null
          raw_sanitized?: Json
          reason_id?: string | null
          resolution_closed_by?: string | null
          resolution_reason?: string | null
          resource?: string | null
          resource_id?: number | null
          source_last_updated: string
          stage?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          action_responsible?: string | null
          affects_reputation?: string | null
          available_actions?: string[]
          claim_id?: number
          date_created?: string | null
          due_date?: string | null
          fulfilled?: boolean | null
          has_incentive?: boolean | null
          last_synced_at?: string
          meli_account_id?: string
          order_id?: number | null
          org_id?: string
          pack_id?: number | null
          problem_sanitized?: string | null
          raw_sanitized?: Json
          reason_id?: string | null
          resolution_closed_by?: string | null
          resolution_reason?: string | null
          resource?: string | null
          resource_id?: number | null
          source_last_updated?: string
          stage?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "claim_reasons"
            referencedColumns: ["reason_id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          due_at: string | null
          id: string
          notes: string | null
          org_id: string
          received_at: string
          request_type: string
          resolved_at: string | null
          status: string
          subject_reference_hash: string
        }
        Insert: {
          due_at?: string | null
          id?: string
          notes?: string | null
          org_id: string
          received_at?: string
          request_type: string
          resolved_at?: string | null
          status?: string
          subject_reference_hash: string
        }
        Update: {
          due_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          received_at?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          subject_reference_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_metrics: {
        Row: {
          id: number
          labels: Json
          meli_account_id: string | null
          name: string
          org_id: string | null
          recorded_at: string
          value: number
        }
        Insert: {
          id?: never
          labels?: Json
          meli_account_id?: string | null
          name: string
          org_id?: string | null
          recorded_at?: string
          value: number
        }
        Update: {
          id?: never
          labels?: Json
          meli_account_id?: string | null
          name?: string
          org_id?: string | null
          recorded_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_metrics_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          available_quantity: number | null
          category_id: string | null
          health: number | null
          inventory_id: string | null
          item_id: string
          last_synced_at: string
          logistic_types: string[]
          meli_account_id: string
          org_id: string
          raw_sanitized: Json
          source_last_updated: string | null
          status: string | null
          sub_status: string[]
          title: string | null
          user_product_id: string | null
          warehouse_management: boolean | null
        }
        Insert: {
          available_quantity?: number | null
          category_id?: string | null
          health?: number | null
          inventory_id?: string | null
          item_id: string
          last_synced_at?: string
          logistic_types?: string[]
          meli_account_id: string
          org_id: string
          raw_sanitized?: Json
          source_last_updated?: string | null
          status?: string | null
          sub_status?: string[]
          title?: string | null
          user_product_id?: string | null
          warehouse_management?: boolean | null
        }
        Update: {
          available_quantity?: number | null
          category_id?: string | null
          health?: number | null
          inventory_id?: string | null
          item_id?: string
          last_synced_at?: string
          logistic_types?: string[]
          meli_account_id?: string
          org_id?: string
          raw_sanitized?: Json
          source_last_updated?: string | null
          status?: string | null
          sub_status?: string[]
          title?: string | null
          user_product_id?: string | null
          warehouse_management?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "items_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_suggestions: {
        Row: {
          cluster_id: string | null
          created_at: string
          evidence_count: number
          id: string
          item_id: string
          meli_account_id: string
          org_id: string
          proposed_change: Json
          rationale: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          suggestion_type: string
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string
          evidence_count?: number
          id?: string
          item_id: string
          meli_account_id: string
          org_id: string
          proposed_change: Json
          rationale: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggestion_type: string
        }
        Update: {
          cluster_id?: string | null
          created_at?: string
          evidence_count?: number
          id?: string
          item_id?: string
          meli_account_id?: string
          org_id?: string
          proposed_change?: Json
          rationale?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggestion_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_suggestions_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "root_cause_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_suggestions_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_accounts: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          last_api_ok_at: string | null
          last_reputation_sync_at: string | null
          level_id: string | null
          linked_at: string
          linked_by: string | null
          nickname: string | null
          org_id: string
          permissions: Json
          power_seller_status: string | null
          seller_id: number
          site_id: string
          status: Database["public"]["Enums"]["meli_account_status"]
          status_reason: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          last_api_ok_at?: string | null
          last_reputation_sync_at?: string | null
          level_id?: string | null
          linked_at?: string
          linked_by?: string | null
          nickname?: string | null
          org_id: string
          permissions?: Json
          power_seller_status?: string | null
          seller_id: number
          site_id: string
          status?: Database["public"]["Enums"]["meli_account_status"]
          status_reason?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          last_api_ok_at?: string | null
          last_reputation_sync_at?: string | null
          level_id?: string | null
          linked_at?: string
          linked_by?: string | null
          nickname?: string | null
          org_id?: string
          permissions?: Json
          power_seller_status?: string | null
          seller_id?: number
          site_id?: string
          status?: Database["public"]["Enums"]["meli_account_status"]
          status_reason?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          actor_role: Database["public"]["Enums"]["message_actor_role"]
          attachment_count: number
          classification_id: string | null
          conversation_path: string | null
          date_available: string | null
          date_created: string
          date_received: string | null
          meli_account_id: string
          message_id: string
          moderation_status: string | null
          order_id: number | null
          org_id: string
          pack_id: number | null
          raw_sanitized: Json
          text_sanitized: string | null
        }
        Insert: {
          actor_role?: Database["public"]["Enums"]["message_actor_role"]
          attachment_count?: number
          classification_id?: string | null
          conversation_path?: string | null
          date_available?: string | null
          date_created: string
          date_received?: string | null
          meli_account_id: string
          message_id: string
          moderation_status?: string | null
          order_id?: number | null
          org_id: string
          pack_id?: number | null
          raw_sanitized?: Json
          text_sanitized?: string | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["message_actor_role"]
          attachment_count?: number
          classification_id?: string | null
          conversation_path?: string | null
          date_available?: string | null
          date_created?: string
          date_received?: string | null
          meli_account_id?: string
          message_id?: string
          moderation_status?: string | null
          order_id?: number | null
          org_id?: string
          pack_id?: number | null
          raw_sanitized?: Json
          text_sanitized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          meli_account_id: string
          order_id: number
          org_id: string
          quantity: number
          seller_sku_hash: string | null
          unit_price: number | null
          user_product_id: string | null
          variation_id: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          meli_account_id: string
          order_id: number
          org_id: string
          quantity: number
          seller_sku_hash?: string | null
          unit_price?: number | null
          user_product_id?: string | null
          variation_id?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          meli_account_id?: string
          order_id?: number
          org_id?: string
          quantity?: number
          seller_sku_hash?: string | null
          unit_price?: number | null
          user_product_id?: string | null
          variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_pseudonym: string | null
          currency_id: string | null
          date_closed: string | null
          date_created: string
          fulfilled: boolean | null
          last_synced_at: string
          meli_account_id: string
          order_id: number
          org_id: string
          pack_id: number | null
          raw_sanitized: Json
          seller_cancelled: boolean | null
          shipment_id: number | null
          source_last_updated: string
          status: string
          tags: string[]
          total_amount: number | null
        }
        Insert: {
          buyer_pseudonym?: string | null
          currency_id?: string | null
          date_closed?: string | null
          date_created: string
          fulfilled?: boolean | null
          last_synced_at?: string
          meli_account_id: string
          order_id: number
          org_id: string
          pack_id?: number | null
          raw_sanitized?: Json
          seller_cancelled?: boolean | null
          shipment_id?: number | null
          source_last_updated: string
          status: string
          tags?: string[]
          total_amount?: number | null
        }
        Update: {
          buyer_pseudonym?: string | null
          currency_id?: string | null
          date_closed?: string | null
          date_created?: string
          fulfilled?: boolean | null
          last_synced_at?: string
          meli_account_id?: string
          order_id?: number
          org_id?: string
          pack_id?: number | null
          raw_sanitized?: Json
          seller_cancelled?: boolean | null
          shipment_id?: number | null
          source_last_updated?: string
          status?: string
          tags?: string[]
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      packs: {
        Row: {
          last_synced_at: string
          meli_account_id: string
          org_id: string
          pack_id: number
          raw_sanitized: Json
          shipment_id: number | null
          source_last_updated: string | null
        }
        Insert: {
          last_synced_at?: string
          meli_account_id: string
          org_id: string
          pack_id: number
          raw_sanitized?: Json
          shipment_id?: number | null
          source_last_updated?: string | null
        }
        Update: {
          last_synced_at?: string
          meli_account_id?: string
          org_id?: string
          pack_id?: number
          raw_sanitized?: Json
          shipment_id?: number | null
          source_last_updated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packs_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          meli_account_id: string | null
          name: string
          org_id: string
          priority: number
          requires_approval: boolean
          trigger_kind: string
          updated_at: string
        }
        Insert: {
          actions: Json
          conditions: Json
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          meli_account_id?: string | null
          name: string
          org_id: string
          priority?: number
          requires_approval?: boolean
          trigger_kind: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          meli_account_id?: string | null
          name?: string
          org_id?: string
          priority?: number
          requires_approval?: boolean
          trigger_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_rules_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answered_at: string | null
          classification_id: string | null
          date_created: string | null
          item_id: string | null
          meli_account_id: string
          org_id: string
          question_id: number
          source_last_updated: string | null
          status: string | null
          text_sanitized: string | null
        }
        Insert: {
          answered_at?: string | null
          classification_id?: string | null
          date_created?: string | null
          item_id?: string | null
          meli_account_id: string
          org_id: string
          question_id: number
          source_last_updated?: string | null
          status?: string | null
          text_sanitized?: string | null
        }
        Update: {
          answered_at?: string | null
          classification_id?: string | null
          date_created?: string | null
          item_id?: string | null
          meli_account_id?: string
          org_id?: string
          question_id?: number
          source_last_updated?: string | null
          status?: string | null
          text_sanitized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_computations: {
        Row: {
          cancellations_denominator: number | null
          cancellations_rate: number | null
          cancellations_value: number | null
          claims_denominator: number | null
          claims_rate: number | null
          claims_value: number | null
          computed_at: string
          delay_denominator: number | null
          delay_rate: number | null
          delay_value: number | null
          drift: Json
          fidelity: Database["public"]["Enums"]["fidelity_status"]
          headroom: Json
          id: string
          meli_account_id: string
          org_id: string
          projections: Json
          rule_set_id: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          cancellations_denominator?: number | null
          cancellations_rate?: number | null
          cancellations_value?: number | null
          claims_denominator?: number | null
          claims_rate?: number | null
          claims_value?: number | null
          computed_at?: string
          delay_denominator?: number | null
          delay_rate?: number | null
          delay_value?: number | null
          drift?: Json
          fidelity?: Database["public"]["Enums"]["fidelity_status"]
          headroom?: Json
          id?: string
          meli_account_id: string
          org_id: string
          projections?: Json
          rule_set_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          cancellations_denominator?: number | null
          cancellations_rate?: number | null
          cancellations_value?: number | null
          claims_denominator?: number | null
          claims_rate?: number | null
          claims_value?: number | null
          computed_at?: string
          delay_denominator?: number | null
          delay_rate?: number | null
          delay_value?: number | null
          drift?: Json
          fidelity?: Database["public"]["Enums"]["fidelity_status"]
          headroom?: Json
          id?: string
          meli_account_id?: string
          org_id?: string
          projections?: Json
          rule_set_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_computations_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_computations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_computations_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "reputation_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_incidents: {
        Row: {
          affect_source: string
          affects_reputation: boolean | null
          claim_id: number | null
          exclusion_reason: string | null
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          last_evaluated_at: string
          meli_account_id: string
          occurred_at: string
          order_id: number | null
          org_id: string
          projected_expiry_at: string | null
          shipment_id: number | null
          source_key: string
        }
        Insert: {
          affect_source?: string
          affects_reputation?: boolean | null
          claim_id?: number | null
          exclusion_reason?: string | null
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          last_evaluated_at?: string
          meli_account_id: string
          occurred_at: string
          order_id?: number | null
          org_id: string
          projected_expiry_at?: string | null
          shipment_id?: number | null
          source_key: string
        }
        Update: {
          affect_source?: string
          affects_reputation?: boolean | null
          claim_id?: number | null
          exclusion_reason?: string | null
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          last_evaluated_at?: string
          meli_account_id?: string
          occurred_at?: string
          order_id?: number | null
          org_id?: string
          projected_expiry_at?: string | null
          shipment_id?: number | null
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_incidents_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_rule_sets: {
        Row: {
          comparators: Json
          created_at: string
          effective_from: string
          effective_to: string | null
          high_volume_min_sales: number | null
          high_volume_window_days: number | null
          id: string
          low_volume_window_days: number
          site_id: string
          source_url: string
          thresholds: Json
          verification_status: string
          verified_at: string | null
          version: string
        }
        Insert: {
          comparators?: Json
          created_at?: string
          effective_from: string
          effective_to?: string | null
          high_volume_min_sales?: number | null
          high_volume_window_days?: number | null
          id?: string
          low_volume_window_days?: number
          site_id: string
          source_url: string
          thresholds: Json
          verification_status: string
          verified_at?: string | null
          version: string
        }
        Update: {
          comparators?: Json
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          high_volume_min_sales?: number | null
          high_volume_window_days?: number | null
          id?: string
          low_volume_window_days?: number
          site_id?: string
          source_url?: string
          thresholds?: Json
          verification_status?: string
          verified_at?: string | null
          version?: string
        }
        Relationships: []
      }
      reputation_snapshots: {
        Row: {
          cancellations_period: string | null
          cancellations_rate: number | null
          cancellations_value: number | null
          claims_period: string | null
          claims_rate: number | null
          claims_value: number | null
          delay_period: string | null
          delay_rate: number | null
          delay_value: number | null
          excluded: Json
          id: string
          level_id: string | null
          meli_account_id: string
          observed_at: string
          org_id: string
          power_seller_status: string | null
          protection_end_date: string | null
          raw_sanitized: Json
          real_level: string | null
          sales_completed: number | null
          sales_period: string | null
        }
        Insert: {
          cancellations_period?: string | null
          cancellations_rate?: number | null
          cancellations_value?: number | null
          claims_period?: string | null
          claims_rate?: number | null
          claims_value?: number | null
          delay_period?: string | null
          delay_rate?: number | null
          delay_value?: number | null
          excluded?: Json
          id?: string
          level_id?: string | null
          meli_account_id: string
          observed_at?: string
          org_id: string
          power_seller_status?: string | null
          protection_end_date?: string | null
          raw_sanitized?: Json
          real_level?: string | null
          sales_completed?: number | null
          sales_period?: string | null
        }
        Update: {
          cancellations_period?: string | null
          cancellations_rate?: number | null
          cancellations_value?: number | null
          claims_period?: string | null
          claims_rate?: number | null
          claims_value?: number | null
          delay_period?: string | null
          delay_rate?: number | null
          delay_value?: number | null
          excluded?: Json
          id?: string
          level_id?: string | null
          meli_account_id?: string
          observed_at?: string
          org_id?: string
          power_seller_status?: string | null
          protection_end_date?: string | null
          raw_sanitized?: Json
          real_level?: string | null
          sales_completed?: number | null
          sales_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_snapshots_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          entity: string
          legal_hold: boolean
          org_id: string
          retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          entity: string
          legal_hold?: boolean
          org_id: string
          retention_days: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          entity?: string
          legal_hold?: boolean
          org_id?: string
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          claim_id: number
          meli_account_id: string
          org_id: string
          raw_sanitized: Json
          return_id: number
          shipment: Json
          source_last_updated: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          claim_id: number
          meli_account_id: string
          org_id: string
          raw_sanitized?: Json
          return_id: number
          shipment?: Json
          source_last_updated?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          claim_id?: number
          meli_account_id?: string
          org_id?: string
          raw_sanitized?: Json
          return_id?: number
          shipment?: Json
          source_last_updated?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_model_versions: {
        Row: {
          active: boolean
          created_at: string
          feature_schema_version: string
          id: string
          intercept: number
          model_type: string
          name: string
          org_id: string | null
          thresholds: Json
          version: string
          weights: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          feature_schema_version: string
          id?: string
          intercept?: number
          model_type: string
          name: string
          org_id?: string | null
          thresholds: Json
          version: string
          weights: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          feature_schema_version?: string
          id?: string
          intercept?: number
          model_type?: string
          name?: string
          org_id?: string | null
          thresholds?: Json
          version?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "risk_model_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_score_features: {
        Row: {
          contribution: number | null
          feature_name: string
          normalized_value: number | null
          raw_value: number | null
          risk_score_id: string
          source: string | null
          weight: number | null
        }
        Insert: {
          contribution?: number | null
          feature_name: string
          normalized_value?: number | null
          raw_value?: number | null
          risk_score_id: string
          source?: string | null
          weight?: number | null
        }
        Update: {
          contribution?: number | null
          feature_name?: string
          normalized_value?: number | null
          raw_value?: number | null
          risk_score_id?: string
          source?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_score_features_risk_score_id_fkey"
            columns: ["risk_score_id"]
            isOneToOne: false
            referencedRelation: "risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scores: {
        Row: {
          cancellation_risk: number | null
          claim_risk: number | null
          computed_at: string
          delay_risk: number | null
          expires_at: string | null
          explanations: Json
          feature_hash: string
          id: string
          meli_account_id: string
          model_version_id: string
          order_id: number | null
          org_id: string
          pack_id: number | null
          risk_band: string
          risk_probability: number
        }
        Insert: {
          cancellation_risk?: number | null
          claim_risk?: number | null
          computed_at?: string
          delay_risk?: number | null
          expires_at?: string | null
          explanations?: Json
          feature_hash: string
          id?: string
          meli_account_id: string
          model_version_id: string
          order_id?: number | null
          org_id: string
          pack_id?: number | null
          risk_band: string
          risk_probability: number
        }
        Update: {
          cancellation_risk?: number | null
          claim_risk?: number | null
          computed_at?: string
          delay_risk?: number | null
          expires_at?: string | null
          explanations?: Json
          feature_hash?: string
          id?: string
          meli_account_id?: string
          model_version_id?: string
          order_id?: number | null
          org_id?: string
          pack_id?: number | null
          risk_band?: string
          risk_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_model_version_id_fkey"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "risk_model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      root_cause_clusters: {
        Row: {
          centroid: string | null
          created_at: string
          first_seen_at: string | null
          id: string
          item_id: string
          label: string
          last_seen_at: string | null
          meli_account_id: string
          org_id: string
          sample_count: number
          status: string
          trend_score: number | null
          updated_at: string
        }
        Insert: {
          centroid?: string | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          item_id: string
          label: string
          last_seen_at?: string | null
          meli_account_id: string
          org_id: string
          sample_count?: number
          status?: string
          trend_score?: number | null
          updated_at?: string
        }
        Update: {
          centroid?: string | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          item_id?: string
          label?: string
          last_seen_at?: string | null
          meli_account_id?: string
          org_id?: string
          sample_count?: number
          status?: string
          trend_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "root_cause_clusters_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "root_cause_clusters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      root_cause_documents: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          item_id: string | null
          meli_account_id: string
          org_id: string
          retention_until: string | null
          source_id: string
          source_type: string
          text_sanitized: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          item_id?: string | null
          meli_account_id: string
          org_id: string
          retention_until?: string | null
          source_id: string
          source_type: string
          text_sanitized: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          item_id?: string | null
          meli_account_id?: string
          org_id?: string
          retention_until?: string | null
          source_id?: string
          source_type?: string
          text_sanitized?: string
        }
        Relationships: [
          {
            foreignKeyName: "root_cause_documents_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "root_cause_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          id: number
          ip_hash: string | null
          meli_account_id: string | null
          metadata: Json
          org_id: string | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          meli_account_id?: string | null
          metadata?: Json
          org_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          meli_account_id?: string | null
          metadata?: Json
          org_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_history: {
        Row: {
          event_at: string
          id: number
          meli_account_id: string
          org_id: string
          shipment_id: number
          source: string
          status: string | null
          substatus: string | null
        }
        Insert: {
          event_at: string
          id?: never
          meli_account_id: string
          org_id: string
          shipment_id: number
          source?: string
          status?: string | null
          substatus?: string | null
        }
        Update: {
          event_at?: string
          id?: never
          meli_account_id?: string
          org_id?: string
          shipment_id?: number
          source?: string
          status?: string | null
          substatus?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_history_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          date_created: string | null
          delivered_at: string | null
          expected_dispatch_at: string | null
          last_synced_at: string
          logistic_type: string | null
          meli_account_id: string
          mode: string | null
          org_id: string
          pack_id: number | null
          raw_sanitized: Json
          service_id: string | null
          shipment_id: number
          shipped_at: string | null
          sla_last_updated: string | null
          sla_service: string | null
          sla_status: string | null
          source_last_updated: string | null
          status: string | null
          substatus: string | null
        }
        Insert: {
          date_created?: string | null
          delivered_at?: string | null
          expected_dispatch_at?: string | null
          last_synced_at?: string
          logistic_type?: string | null
          meli_account_id: string
          mode?: string | null
          org_id: string
          pack_id?: number | null
          raw_sanitized?: Json
          service_id?: string | null
          shipment_id: number
          shipped_at?: string | null
          sla_last_updated?: string | null
          sla_service?: string | null
          sla_status?: string | null
          source_last_updated?: string | null
          status?: string | null
          substatus?: string | null
        }
        Update: {
          date_created?: string | null
          delivered_at?: string | null
          expected_dispatch_at?: string | null
          last_synced_at?: string
          logistic_type?: string | null
          meli_account_id?: string
          mode?: string | null
          org_id?: string
          pack_id?: number | null
          raw_sanitized?: Json
          service_id?: string | null
          shipment_id?: number
          shipped_at?: string | null
          sla_last_updated?: string | null
          sla_service?: string | null
          sla_status?: string | null
          source_last_updated?: string | null
          status?: string | null
          substatus?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_checkpoints: {
        Row: {
          cursor: Json
          high_watermark: string | null
          meli_account_id: string
          org_id: string
          resource_kind: string
          updated_at: string
        }
        Insert: {
          cursor?: Json
          high_watermark?: string | null
          meli_account_id: string
          org_id: string
          resource_kind: string
          updated_at?: string
        }
        Update: {
          cursor?: Json
          high_watermark?: string | null
          meli_account_id?: string
          org_id?: string
          resource_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_checkpoints_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_checkpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          cursor: Json
          estimated_total: number | null
          id: string
          kind: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          meli_account_id: string
          next_run_at: string
          org_id: string
          priority: number
          processed_count: number
          progress: number
          range_end: string | null
          range_start: string | null
          resource_kind: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          cursor?: Json
          estimated_total?: number | null
          id?: string
          kind: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          meli_account_id: string
          next_run_at?: string
          org_id: string
          priority?: number
          processed_count?: number
          progress?: number
          range_end?: string | null
          range_start?: string | null
          resource_kind?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          cursor?: Json
          estimated_total?: number | null
          id?: string
          kind?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          meli_account_id?: string
          next_run_at?: string
          org_id?: string
          priority?: number
          processed_count?: number
          progress?: number
          range_end?: string | null
          range_start?: string | null
          resource_kind?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_product_stock: {
        Row: {
          full_stock: number | null
          last_synced_at: string
          locations: Json
          meli_account_id: string
          org_id: string
          stock_version: number | null
          total_seller_stock: number | null
          user_product_id: string
        }
        Insert: {
          full_stock?: number | null
          last_synced_at?: string
          locations?: Json
          meli_account_id: string
          org_id: string
          stock_version?: number | null
          total_seller_stock?: number | null
          user_product_id: string
        }
        Update: {
          full_stock?: number | null
          last_synced_at?: string
          locations?: Json
          meli_account_id?: string
          org_id?: string
          stock_version?: number | null
          total_seller_stock?: number | null
          user_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_stock_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_product_stock_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_dedupe: {
        Row: {
          event_key: string
          expires_at: string
          first_received_at: string
        }
        Insert: {
          event_key: string
          expires_at?: string
          first_received_at?: string
        }
        Update: {
          event_key?: string
          expires_at?: string
          first_received_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          actions: Json | null
          application_id: number | null
          attempts: number | null
          event_key: string
          external_event_id: string | null
          id: string
          meli_account_id: string | null
          org_id: string | null
          processed_at: string | null
          processing_error: string | null
          received_at: string
          resource: string
          sent_at: string | null
          status: string
          topic: string
          user_id: number | null
        }
        Insert: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource: string
          sent_at?: string | null
          status?: string
          topic: string
          user_id?: number | null
        }
        Update: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key?: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource?: string
          sent_at?: string | null
          status?: string
          topic?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events_2026_09: {
        Row: {
          actions: Json | null
          application_id: number | null
          attempts: number | null
          event_key: string
          external_event_id: string | null
          id: string
          meli_account_id: string | null
          org_id: string | null
          processed_at: string | null
          processing_error: string | null
          received_at: string
          resource: string
          sent_at: string | null
          status: string
          topic: string
          user_id: number | null
        }
        Insert: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource: string
          sent_at?: string | null
          status?: string
          topic: string
          user_id?: number | null
        }
        Update: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key?: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource?: string
          sent_at?: string | null
          status?: string
          topic?: string
          user_id?: number | null
        }
        Relationships: []
      }
      webhook_events_2026_10: {
        Row: {
          actions: Json | null
          application_id: number | null
          attempts: number | null
          event_key: string
          external_event_id: string | null
          id: string
          meli_account_id: string | null
          org_id: string | null
          processed_at: string | null
          processing_error: string | null
          received_at: string
          resource: string
          sent_at: string | null
          status: string
          topic: string
          user_id: number | null
        }
        Insert: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource: string
          sent_at?: string | null
          status?: string
          topic: string
          user_id?: number | null
        }
        Update: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key?: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource?: string
          sent_at?: string | null
          status?: string
          topic?: string
          user_id?: number | null
        }
        Relationships: []
      }
      webhook_events_2026_11: {
        Row: {
          actions: Json | null
          application_id: number | null
          attempts: number | null
          event_key: string
          external_event_id: string | null
          id: string
          meli_account_id: string | null
          org_id: string | null
          processed_at: string | null
          processing_error: string | null
          received_at: string
          resource: string
          sent_at: string | null
          status: string
          topic: string
          user_id: number | null
        }
        Insert: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource: string
          sent_at?: string | null
          status?: string
          topic: string
          user_id?: number | null
        }
        Update: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key?: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource?: string
          sent_at?: string | null
          status?: string
          topic?: string
          user_id?: number | null
        }
        Relationships: []
      }
      webhook_events_default: {
        Row: {
          actions: Json | null
          application_id: number | null
          attempts: number | null
          event_key: string
          external_event_id: string | null
          id: string
          meli_account_id: string | null
          org_id: string | null
          processed_at: string | null
          processing_error: string | null
          received_at: string
          resource: string
          sent_at: string | null
          status: string
          topic: string
          user_id: number | null
        }
        Insert: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource: string
          sent_at?: string | null
          status?: string
          topic: string
          user_id?: number | null
        }
        Update: {
          actions?: Json | null
          application_id?: number | null
          attempts?: number | null
          event_key?: string
          external_event_id?: string | null
          id?: string
          meli_account_id?: string | null
          org_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          resource?: string
          sent_at?: string | null
          status?: string
          topic?: string
          user_id?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      latest_reputation: {
        Row: {
          cancellations_rate: number | null
          claims_rate: number | null
          delay_rate: number | null
          level_id: string | null
          meli_account_id: string | null
          observed_at: string | null
          org_id: string | null
          power_seller_status: string | null
          sales_completed: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_snapshots_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      latest_risk_per_order: {
        Row: {
          cancellation_risk: number | null
          claim_risk: number | null
          computed_at: string | null
          delay_risk: number | null
          explanations: Json | null
          meli_account_id: string | null
          order_id: number | null
          org_id: string | null
          pack_id: number | null
          risk_band: string | null
          risk_probability: number | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_operational_risk: {
        Row: {
          cancellation_risk: number | null
          claim_risk: number | null
          computed_at: string | null
          date_created: string | null
          delay_risk: number | null
          expected_dispatch_at: string | null
          explanations: Json | null
          meli_account_id: string | null
          order_id: number | null
          org_id: string | null
          pack_id: number | null
          risk_band: string | null
          risk_probability: number | null
          sla_status: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_meli_account_id_fkey"
            columns: ["meli_account_id"]
            isOneToOne: false
            referencedRelation: "meli_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      backend_acknowledge_alert: {
        Args: { p_actor: string; p_alert_id: string; p_org_id: string }
        Returns: undefined
      }
      backend_acquire_refresh_lease: {
        Args: {
          p_account_id: string
          p_expected_version: number
          p_lease_seconds?: number
          p_owner: string
        }
        Returns: boolean
      }
      backend_approve_action: {
        Args: { p_action_id: string; p_actor: string; p_org_id: string }
        Returns: Database["public"]["Enums"]["action_status"]
      }
      backend_cancel_action: {
        Args: { p_action_id: string; p_actor: string; p_org_id: string }
        Returns: undefined
      }
      backend_claim_sync_job: {
        Args: { p_lease_seconds?: number }
        Returns: {
          attempts: number
          created_at: string
          cursor: Json
          estimated_total: number | null
          id: string
          kind: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          meli_account_id: string
          next_run_at: string
          org_id: string
          priority: number
          processed_count: number
          progress: number
          range_end: string | null
          range_start: string | null
          resource_kind: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      backend_commit_refresh: {
        Args: {
          p_access_token: string
          p_account_id: string
          p_expected_version: number
          p_expires_at: string
          p_owner: string
          p_refresh_token: string
          p_scope: string[]
        }
        Returns: number
      }
      backend_consume_oauth_link_attempt: {
        Args: { p_state_hash: string }
        Returns: {
          code_verifier: string
          id: string
          org_id: string
          redirect_uri: string
          site_id: string
          user_id: string
        }[]
      }
      backend_create_oauth_link_attempt: {
        Args: {
          p_code_verifier?: string
          p_org_id: string
          p_redirect_uri: string
          p_site_id: string
          p_state_hash: string
          p_ttl_seconds?: number
          p_user_id: string
        }
        Returns: string
      }
      backend_create_webhook_partition: {
        Args: { p_month: string }
        Returns: undefined
      }
      backend_disconnect_meli_account: {
        Args: { p_account_id: string; p_actor: string; p_org_id: string }
        Returns: undefined
      }
      backend_enqueue_action_execution: {
        Args: {
          p_action_id: string
          p_actor: string
          p_correlation_id?: string
          p_org_id: string
        }
        Returns: undefined
      }
      backend_enqueue_bootstrap: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      backend_get_oauth_material: {
        Args: { p_account_id: string }
        Returns: {
          access_token: string
          account_status: Database["public"]["Enums"]["meli_account_status"]
          credential_version: number
          expires_at: string
          refresh_lease_owner: string
          refresh_lease_until: string
          refresh_token: string
        }[]
      }
      backend_ingest_webhook: {
        Args: {
          p_actions: string[]
          p_application_id: number
          p_attempts: number
          p_event_key: string
          p_meli_account_id: string
          p_org_id: string
          p_resource: string
          p_sent_at: string
          p_topic: string
          p_user_id: number
        }
        Returns: boolean
      }
      backend_link_meli_account: {
        Args: {
          p_access_token: string
          p_expires_at: string
          p_nickname: string
          p_org_id: string
          p_refresh_token: string
          p_scope: string[]
          p_seller_id: number
          p_site_id: string
          p_user_id: string
        }
        Returns: string
      }
      backend_penalize_rate_bucket: {
        Args: { p_blocked_ms?: number; p_bucket_key: string }
        Returns: undefined
      }
      backend_provision_rate_buckets: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      backend_record_metric: {
        Args: {
          p_labels?: Json
          p_meli_account_id?: string
          p_name: string
          p_org_id?: string
          p_value: number
        }
        Returns: undefined
      }
      backend_relax_rate_buckets: { Args: never; Returns: undefined }
      backend_release_refresh_lease: {
        Args: { p_account_id: string; p_owner: string }
        Returns: undefined
      }
      backend_request_reconcile: {
        Args: {
          p_account_id: string
          p_actor: string
          p_org_id: string
          p_resource_kind?: string
        }
        Returns: string
      }
      backend_store_reputation_computation: {
        Args: {
          p_account_id: string
          p_drift: Json
          p_fidelity: Database["public"]["Enums"]["fidelity_status"]
          p_headroom: Json
          p_metrics: Json
          p_org_id: string
          p_projections: Json
          p_rule_set_id: string
          p_window_end: string
          p_window_start: string
        }
        Returns: string
      }
      backend_store_reputation_snapshot: {
        Args: { p_account_id: string; p_org_id: string; p_reputation: Json }
        Returns: string
      }
      backend_store_risk_score: {
        Args: {
          p_account_id: string
          p_band: string
          p_cancellation_risk: number
          p_claim_risk: number
          p_delay_risk: number
          p_explanations: Json
          p_feature_hash: string
          p_features: Json
          p_model_version_id: string
          p_order_id: number
          p_org_id: string
          p_pack_id: number
          p_risk: number
        }
        Returns: string
      }
      backend_take_rate_token: {
        Args: { p_bucket_key: string; p_cost?: number }
        Returns: {
          granted: boolean
          tokens_remaining: number
          wait_ms: number
        }[]
      }
      backend_upsert_claim: {
        Args: {
          p_account_id: string
          p_affects_reputation?: Json
          p_claim: Json
          p_claim_id: number
          p_org_id: string
        }
        Returns: boolean
      }
      backend_upsert_item: {
        Args: {
          p_account_id: string
          p_item: Json
          p_item_id: string
          p_org_id: string
        }
        Returns: boolean
      }
      backend_upsert_messages: {
        Args: {
          p_account_id: string
          p_conversation_status: Json
          p_messages: Json
          p_org_id: string
          p_pack_id: number
        }
        Returns: number
      }
      backend_upsert_order: {
        Args: {
          p_account_id: string
          p_currency_id: string
          p_date_closed: string
          p_date_created: string
          p_order_id: number
          p_order_items: Json
          p_org_id: string
          p_pack_id: number
          p_shipment_id: number
          p_source_last_updated: string
          p_status: string
          p_tags: Json
          p_total_amount: number
        }
        Returns: boolean
      }
      backend_upsert_question: {
        Args: {
          p_account_id: string
          p_org_id: string
          p_question: Json
          p_question_id: number
          p_text_sanitized: string
        }
        Returns: boolean
      }
      backend_upsert_shipment: {
        Args: {
          p_account_id: string
          p_org_id: string
          p_shipment: Json
          p_shipment_id: number
          p_sla?: Json
        }
        Returns: boolean
      }
      create_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      org_role_for: {
        Args: { p_org_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
    }
    Enums: {
      action_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "executing"
        | "executed"
        | "blocked_policy"
        | "failed"
        | "expired"
        | "cancelled"
      fidelity_status: "initializing" | "calibrated" | "degraded" | "unknown"
      incident_type: "claim" | "cancellation" | "delay" | "mediation"
      job_status:
        | "queued"
        | "running"
        | "paused"
        | "done"
        | "failed"
        | "cancelled"
      meli_account_status:
        | "onboarding"
        | "backfilling"
        | "active"
        | "degraded"
        | "reconnect_required"
        | "restricted"
        | "disconnected"
      message_actor_role:
        | "buyer"
        | "seller"
        | "meli_agent"
        | "system"
        | "unknown"
      org_role: "owner" | "admin" | "operator" | "viewer"
      suggestion_status:
        | "new"
        | "accepted"
        | "rejected"
        | "applied"
        | "dismissed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_status: [
        "draft",
        "pending_approval",
        "approved",
        "executing",
        "executed",
        "blocked_policy",
        "failed",
        "expired",
        "cancelled",
      ],
      fidelity_status: ["initializing", "calibrated", "degraded", "unknown"],
      incident_type: ["claim", "cancellation", "delay", "mediation"],
      job_status: [
        "queued",
        "running",
        "paused",
        "done",
        "failed",
        "cancelled",
      ],
      meli_account_status: [
        "onboarding",
        "backfilling",
        "active",
        "degraded",
        "reconnect_required",
        "restricted",
        "disconnected",
      ],
      message_actor_role: [
        "buyer",
        "seller",
        "meli_agent",
        "system",
        "unknown",
      ],
      org_role: ["owner", "admin", "operator", "viewer"],
      suggestion_status: [
        "new",
        "accepted",
        "rejected",
        "applied",
        "dismissed",
      ],
    },
  },
} as const

