import { createClient } from "@/lib/supabase/server";
import type { Member, Profile } from "@/types/database";
import { TeamClient } from "./TeamClient";

export default async function MembersPage() {
  const supabase = await createClient();
  const [{ data: members }, { data: staff }] = await Promise.all([
    supabase.from("members").select("*").order("created_at"),
    supabase.from("profiles").select("id, name").order("member_no", { nullsFirst: false }).order("name"),
  ]);

  return (
    <TeamClient
      members={(members as Member[]) ?? []}
      staffList={(staff as Pick<Profile, "id" | "name">[]) ?? []}
      todayISO={new Date().toISOString().slice(0, 10)}
    />
  );
}
