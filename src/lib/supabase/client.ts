import { createBrowserClient } from "@supabase/ssr";

// 実運用でスキーマが固まったら `supabase gen types typescript` で生成した
// Database 型に差し替えると補完・型チェックがさらに強化される。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
