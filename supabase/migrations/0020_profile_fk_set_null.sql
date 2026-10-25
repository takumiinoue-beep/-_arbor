-- =========================================
-- 0020: 担当者（profiles）を削除できるように
--   「登録者・更新者・変更者」として担当者を参照している列は、担当者を削除したら空欄(null)になるようにする。
--   （これまで経費・取引先請求・案件獲得などを登録した担当者は、削除しようとするとエラーになっていた）
--   案件の担当者(projects.staff_id)と案件獲得のOP(acquisitions.staff_id)は、
--   売上データが失われないよう、これまで通り削除をブロックする。
--   既存データは変更しません。
-- =========================================
do $$
declare
  target record;
  fk record;
begin
  for target in
    select * from (values
      ('projects', 'updated_by'),
      ('actual_logs', 'changed_by'),
      ('acquisitions', 'created_by'),
      ('expenses', 'created_by'),
      ('vendor_invoices', 'created_by')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || target.tbl) is null then
      continue;
    end if;

    -- この列の profiles への外部キーを探して作り直す
    for fk in
      select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f'
        and c.conrelid = ('public.' || target.tbl)::regclass
        and c.confrelid = 'public.profiles'::regclass
        and a.attname = target.col
    loop
      execute format('alter table public.%I drop constraint %I', target.tbl, fk.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles (id) on delete set null',
      target.tbl, target.tbl || '_' || target.col || '_fkey', target.col
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
