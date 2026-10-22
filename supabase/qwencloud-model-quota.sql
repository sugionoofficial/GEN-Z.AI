-- =========================================================
-- GEN-Z.AI
-- QWENCLOUD MODEL FREE QUOTA
-- ---------------------------------------------------------
-- File:
--   supabase/qwencloud-model-quota.sql
--
-- Fungsi:
--   1. Tabel pelacak kuota gratis per model QwenCloud.
--   2. View sisa detik + persentase (dipakai halaman
--      Edit Model dan Tambah Model).
--   3. Trigger: saat pemakaian mencapai total, model
--      OTOMATIS dinonaktifkan sehingga hilang dari
--      halaman Generate tanpa perlu aksi manual.
--   4. RPC admin_set_model_quota() untuk mengubah total,
--      koreksi manual, dan reset pemakaian.
--
-- Cara pakai:
--   Jalankan file ini di Supabase -> SQL Editor.
--   Aman dijalankan berulang (idempotent).
--
-- CATATAN
--   - QwenCloud tidak menyediakan endpoint pembacaan sisa
--     kuota gratis. Karena itu total detik diisi MANUAL
--     oleh admin, sedangkan pemakaian dihitung otomatis
--     dari generation_history (status processing/success).
--   - total_seconds = 0 berarti pelacakan dimatikan untuk
--     model tersebut (tidak pernah auto nonaktif).
--   - Model tanpa parameter durasi (wan2.2-animate-*,
--     happyhorse-1.0-video-edit) tidak menambah pemakaian
--     otomatis; pakai manual_used_seconds.
-- =========================================================


-- =========================================================
-- 1. TABEL
-- =========================================================

create table if not exists public.model_quota (

    model_id uuid primary key
        references public.models(id)
        on delete cascade,

    provider_code text not null
        default 'qwencloud',

    total_seconds integer not null
        default 0
        check (total_seconds >= 0),

    manual_used_seconds integer not null
        default 0
        check (manual_used_seconds >= 0),

    started_at timestamptz not null
        default now(),

    expires_at date,

    auto_disabled_at timestamptz,

    previous_status text,

    updated_at timestamptz not null
        default now()

);


comment on table public.model_quota is
    'Kuota gratis per model (detik) untuk provider QwenCloud.';

comment on column public.model_quota.started_at is
    'Titik nol hitungan pemakaian. Reset = now().';

comment on column public.model_quota.manual_used_seconds is
    'Koreksi manual untuk model yang tidak punya durasi.';


/*
 * Data kuota hanya dibaca lewat API admin (service role),
 * jadi RLS ditutup untuk anon / authenticated.
 */

alter table public.model_quota
    enable row level security;


-- =========================================================
-- 2. VIEW STATUS KUOTA
-- =========================================================

create or replace view public.qwencloud_model_quota as
select
    q.model_id,
    m.model_id as model_code,
    m.model_name,
    m.status,
    q.total_seconds,
    q.manual_used_seconds,
    q.started_at,
    q.expires_at,
    q.auto_disabled_at,

    coalesce(
        sum(h.duration)
        filter (
            where h.status in ('processing', 'success')
        ),
        0
    )::int + q.manual_used_seconds as used_seconds,

    greatest(
        q.total_seconds
        - coalesce(
            sum(h.duration)
            filter (
                where h.status in ('processing', 'success')
            ),
            0
        )::int
        - q.manual_used_seconds,
        0
    ) as remaining_seconds,

    case
        when q.total_seconds > 0 then
            round(
                greatest(
                    q.total_seconds
                    - coalesce(
                        sum(h.duration)
                        filter (
                            where h.status in ('processing', 'success')
                        ),
                        0
                    )::int
                    - q.manual_used_seconds,
                    0
                ) * 100.0 / q.total_seconds
            )::int
        else 0
    end as remaining_percent

from public.model_quota q

join public.models m
  on m.id = q.model_id

left join public.generation_history h
       on h.model_id = m.model_id
      and h.provider_id = 'qwencloud'
      and h.created_at >= q.started_at

group by
    q.model_id,
    m.model_id,
    m.model_name,
    m.status,
    q.total_seconds,
    q.manual_used_seconds,
    q.started_at,
    q.expires_at,
    q.auto_disabled_at;


revoke all on public.qwencloud_model_quota
    from anon, authenticated;


-- =========================================================
-- 3. AUTO NONAKTIF
-- =========================================================

create or replace function public.qwencloud_quota_recheck(
    p_model_uuid uuid
)
returns void
language plpgsql
security definer
as $$
declare
    v_total integer;
    v_used integer;
begin

    select total_seconds, used_seconds
      into v_total, v_used
      from public.qwencloud_model_quota
     where model_id = p_model_uuid;

    if v_total is null or v_total = 0 then
        return;
    end if;

    if coalesce(v_used, 0) < v_total then
        return;
    end if;

    update public.models
       set status = 'inactive',
           updated_at = now()
     where id = p_model_uuid
       and status <> 'inactive';

    update public.model_quota
       set auto_disabled_at =
               coalesce(auto_disabled_at, now()),
           previous_status =
               coalesce(previous_status, 'active'),
           updated_at = now()
     where model_id = p_model_uuid;

end;
$$;


create or replace function public.qwencloud_quota_after_generation()
returns trigger
language plpgsql
security definer
as $$
declare
    v_model_uuid uuid;
begin

    if new.provider_id <> 'qwencloud' then
        return new;
    end if;

    if new.status not in ('processing', 'success') then
        return new;
    end if;

    select q.model_id
      into v_model_uuid
      from public.model_quota q
      join public.models m
        on m.id = q.model_id
     where m.model_id = new.model_id
     limit 1;

    if v_model_uuid is not null then
        perform public.qwencloud_quota_recheck(
            v_model_uuid
        );
    end if;

    return new;
end;
$$;


drop trigger if exists trg_qwencloud_quota
    on public.generation_history;

create trigger trg_qwencloud_quota
after insert or update of status
    on public.generation_history
for each row
execute function public.qwencloud_quota_after_generation();


-- =========================================================
-- 4. RPC ADMIN
-- =========================================================

create or replace function public.admin_set_model_quota(
    p_model_uuid uuid,
    p_total_seconds integer,
    p_expires_at date default null,
    p_manual_used integer default 0,
    p_reset boolean default false
)
returns void
language plpgsql
security definer
as $$
begin

    insert into public.model_quota (
        model_id,
        total_seconds,
        manual_used_seconds,
        expires_at
    )
    values (
        p_model_uuid,
        greatest(coalesce(p_total_seconds, 0), 0),
        greatest(coalesce(p_manual_used, 0), 0),
        p_expires_at
    )
    on conflict (model_id) do update
    set total_seconds =
            greatest(coalesce(p_total_seconds, 0), 0),
        manual_used_seconds =
            greatest(coalesce(p_manual_used, 0), 0),
        expires_at =
            p_expires_at,
        started_at =
            case when p_reset then now()
                 else model_quota.started_at end,
        auto_disabled_at =
            case when p_reset then null
                 else model_quota.auto_disabled_at end,
        previous_status =
            case when p_reset then null
                 else model_quota.previous_status end,
        updated_at =
            now();

    /*
     * Reset pemakaian = model yang tadinya dinonaktifkan
     * otomatis boleh muncul lagi di Generate.
     */
    if p_reset then
        update public.models
           set status = 'active',
               updated_at = now()
         where id = p_model_uuid
           and status = 'inactive';
    end if;


    /*
     * Selain reset: kalau admin menaikkan total kuota
     * sampai pemakaian kembali di bawah batas, model yang
     * tadinya dinonaktifkan OTOMATIS diaktifkan lagi.
     * Model yang dinonaktifkan manual tidak disentuh.
     */
    if not p_reset then
        update public.models m
           set status = 'active',
               updated_at = now()
          from public.model_quota q
         where q.model_id = p_model_uuid
           and m.id = q.model_id
           and m.status = 'inactive'
           and q.auto_disabled_at is not null
           and q.total_seconds > 0
           and (
                q.total_seconds
                - coalesce((
                    select sum(h.duration)
                    from public.generation_history h
                    where h.model_id = m.model_id
                      and h.provider_id = 'qwencloud'
                      and h.status in ('processing', 'success')
                      and h.created_at >= q.started_at
                ), 0)::int
                - q.manual_used_seconds
           ) > 0;

        update public.model_quota q
           set auto_disabled_at = null,
               previous_status = null,
               updated_at = now()
         where q.model_id = p_model_uuid
           and q.auto_disabled_at is not null
           and (
                select count(*)
                from public.models m
                where m.id = q.model_id
                  and m.status = 'active'
           ) > 0;
    end if;


    perform public.qwencloud_quota_recheck(
        p_model_uuid
    );

end;
$$;


-- =========================================================
-- 5. SEED KUOTA MODEL QWENCLOUD
--    Wan 50 detik, HappyHorse 10 detik (kuota gratis).
--    Silakan sesuaikan lewat halaman Edit Model.
-- =========================================================

insert into public.model_quota (
    model_id,
    total_seconds,
    expires_at
)
select
    m.id,
    case
        when m.model_id like 'qwen-happyhorse%' then 10
        else 50
    end,
    date '2027-01-19'
from public.models m
join public.providers p
  on p.id = m.provider_id
where p.provider_id = 'qwencloud'
on conflict (model_id) do nothing;


-- =========================================================
-- 6. VERIFIKASI
-- =========================================================

-- select model_code, status, total_seconds, used_seconds,
--        remaining_seconds, remaining_percent,
--        expires_at, auto_disabled_at
-- from public.qwencloud_model_quota
-- order by model_code;
