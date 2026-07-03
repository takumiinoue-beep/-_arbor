import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 実運用でスキーマが固まったら `supabase gen types typescript` で生成した
// Database 型に差し替えると補完・型チェックがさらに強化される。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component から呼ばれた場合は無視して良い（middleware がセッションを更新する）
          }
        },
      },
    }
  );
}
