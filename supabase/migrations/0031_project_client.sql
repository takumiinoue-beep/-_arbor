-- =========================================
-- 0031: 案件に取引先（どこからの案件か）を設定できるようにする
--   projects.client_id：取引先（clients）への参照。任意（空でもよい）。
--   取引先を削除しても案件は残り、取引先だけが空になる。既存データは変更しません。
-- =========================================
alter table public.projects
  add column if not exists client_id bigint references public.clients (id) on delete set null;

create index if not exists idx_projects_client_id on public.projects (client_id);

notify pgrst, 'reload schema';
