export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CareLogType =
  | "water"
  | "fertilizer"
  | "pruning"
  | "repotting";

export type RecommendationSource = "rules" | "ai";

export interface Database {
  public: {
    Tables: {
      plants: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          species_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          display_name?: string | null;
          species_name?: string | null;
          notes?: string | null;
        };
        Update: {
          display_name?: string | null;
          species_name?: string | null;
          notes?: string | null;
        };
      };
      care_logs: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          log_type: CareLogType;
          occurred_at: string;
          notes: string | null;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          plant_id: string;
          log_type: CareLogType;
          occurred_at?: string;
          notes?: string | null;
          meta?: Json | null;
        };
        Update: {
          log_type?: CareLogType;
          occurred_at?: string;
          notes?: string | null;
          meta?: Json | null;
        };
      };
      plant_photos: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          storage_path: string;
          content_type: string;
          byte_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          plant_id: string;
          storage_path: string;
          content_type: string;
          byte_size?: number | null;
        };
        Update: {
          content_type?: string;
          byte_size?: number | null;
        };
      };
      plant_diagnoses: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          source_photo_id: string | null;
          model_provider: string;
          model_name: string;
          summary: string;
          structured: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          plant_id: string;
          source_photo_id?: string | null;
          model_provider: string;
          model_name: string;
          summary: string;
          structured?: Json | null;
        };
        Update: {
          summary?: string;
          structured?: Json | null;
        };
      };
      care_recommendations: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          for_date: string;
          actions: Json;
          source: RecommendationSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          plant_id: string;
          for_date: string;
          actions: Json;
          source?: RecommendationSource;
        };
        Update: {
          actions?: Json;
          source?: RecommendationSource;
        };
      };
    };
  };
}
