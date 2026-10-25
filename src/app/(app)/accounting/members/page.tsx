import { createClient } from "@/lib/supabase/server";
import type { Member, Profile } from "@/types/database";
import { MembersClient } from "./MembersClient";

export default async function MembersPage() {
  const supabase = await createClient();
  const [{ data: members }, { data: staff }] = await Promise.all([
    supabase.from("members").select("*").order("created_at"),
    supabase.from("profiles").select("id, name").order("name"),
  ]);

  return (
    <MembersClient
      members={(members as Member[]) ?? []}
      staffList={(staff as Pick<Profile, "id" | "name">[]) ?? []}
      todayISO={new Date().toISOString().slice(0, 10)}
    />
  );
}
