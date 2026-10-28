-- ---------------------------------------------------------------------------
-- Master Switch 3-Status untuk Studio Medsos (ACTIVE / OFF / MAINTENANCE)
-- ---------------------------------------------------------------------------
-- Menyimpan status global_status ('active' | 'off' | 'maintenance') selaras
-- dengan global_enabled (true hanya saat global_status = 'active') agar RPC
-- claim_due_social_post_schedules tetap bekerja tanpa perubahan breaking.

alter table public.social_publisher_config
    add column if not exists global_status text not null default 'off';

alter table public.social_publisher_config
    drop constraint if exists social_publisher_config_global_status_check;

alter table public.social_publisher_config
    add constraint social_publisher_config_global_status_check
        check (global_status in ('active', 'off', 'maintenance'));

update public.social_publisher_config
set global_status = case
    when global_enabled = true then 'active'
    when global_status = 'maintenance' then 'maintenance'
    else 'off'
end;

notify pgrst, 'reload schema';
