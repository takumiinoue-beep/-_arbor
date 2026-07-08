import { requireProfile } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">プロフィール編集</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
