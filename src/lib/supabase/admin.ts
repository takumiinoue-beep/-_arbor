import "server-only";
import { createClient } from "@supabase/supabase-js";

// service role key を使う特権クライアント。
// 担当者アカウントの発行・削除など管理者操作専用。サーバー側でのみ import すること。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
