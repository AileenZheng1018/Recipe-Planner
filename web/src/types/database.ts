export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_items: {
        Row: {
          id: string
          user_id: string
          ingredient_id: string
          quantity_g: number
          priority: 'high' | 'normal'
          price_paid: number | null
          purchased_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ingredient_id: string
          quantity_g: number
          priority?: 'high' | 'normal'
          price_paid?: number | null
          purchased_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ingredient_id?: string
          quantity_g?: number
          priority?: 'high' | 'normal'
          price_paid?: number | null
          purchased_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row']
export type InventoryItemInsert = Database['public']['Tables']['inventory_items']['Insert']
export type InventoryItemUpdate = Database['public']['Tables']['inventory_items']['Update']
