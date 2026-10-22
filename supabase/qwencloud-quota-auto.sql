-- =========================================================
-- GEN-Z.AI
-- QWENCLOUD QUOTA — AUTO USAGE (NO MANUAL INPUT)
-- ---------------------------------------------------------
-- File:
--   supabase/qwencloud-quota-auto.sql
--
-- Perubahan dibanding qwencloud-model-quota.sql:
--   1. Kolom manual_used_seconds DIHAPUS. Pemakaian 100%
--      dihitung dari generation_history.
--   2. Potong kuota otomatis saat generate: baris history
--      berstatus "processing" (reservasi) langsung dihitung.
--   3. Kembalikan kuota otomatis saat generate gagal:
--      status "failed" / "cancelled" / "error" tidak dihitung
--      sehingga detiknya kembali.
--   4. qwencloud_quota_reconcile(): menonaktifkan model saat
--      kuota habis DAN mengaktifkan kembali saat pemakaian
--      turun lagi (refund) selama model dinonaktifkan otomatis.
--   5. RPC admin_set_model_quota() tanpa p_manual_used.
--
-- Sumber kebenaran status:
--   Status task (gagal / sukses) berasal dari respons API
--   QwenCloud yang ditulis ke generation_history oleh
--   api/generate-status.js. Trigger di bawah hanya membaca
--   kolom status + duration tersebut.
--
-- Aman dijalankan berulang (idempotent).
-- =========================================================


-- =========================================================
-- 1. HAPUS PEMAKAIAN MANUAL
-- =========================================================

drop view if exists public.qwencloud_model_quota;

alter table public.model_quota
    drop column if exists manual_used_seconds;


-- =========================================================
-- 2. VIEW STATUS KUOTA (AUTO)
-- =========================================================

create or replace view public.qwencloud_model_quota as
select
    q.model_id,
    m.model_id as model_code,
    m.model_name,
    m.status,
    q.total_seconds,
    q.started_at,
    q.expires_at,
    q.auto_disabled_at,

    coalesce(
        sum(nullif(h.duration, 0))
        filter (
            where h.status = 'success'
               or (
                    h.status = 'processing'
                and h.created_at > now() - interval '2 hours'
               )
        ),
        0
    )::int as used_seconds,

    greatest(
        q.total_seconds
        - coalesce(
            sum(nullif(h.duration, 0))
            filter (
            where h.status = 'success'
               or (
                    h.status = 'processing'
                and h.created_at > now() - interval '2 hours'
               )
        ),
            0
        )::int,
        0
    ) as remaining_seconds,

    case
        when q.total_seconds > 0 then
            round(
                greatest(
                    q.total_seconds
                    - coalesce(
                        sum(nullif(h.duration, 0))
                        filter (
            where h.status = 'success'
               or (
                    h.status = 'processing'
                and h.created_at > now() - interval '2 hours'
               )
        ),
                        0
                    )::int,
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
    q.started_at,
    q.expires_at,
    q.auto_disabled_at;


revoke all on public.qwencloud_model_quota
    from anon, authenticated;


-- =========================================================
-- 3. PEMAKAIAN EFEKTIF
-- =========================================================

create or replace function public.qwencloud_used_seconds(
    p_model_uuid uuid
)
returns integer
language sql
stable
security definer
as $$
    select coalesce(
        sum(nullif(h.duration, 0)),
        0
    )::int
    from public.generation_history h
    join public.models m
      on m.model_id = h.model_id
    join public.model_quota q
      on q.model_id = m.id
    where m.id = p_model_uuid
      and h.provider_id = 'qwencloud'
      and h.created_at >= q.started_at
      and (
            h.status = 'success'
         or (
                h.status = 'processing'
            and h.created_at > now() - interval '2 hours'
            )
      );
$$;


-- =========================================================
-- 4. RECONCILE: AUTO NONAKTIF + AUTO REFUND
-- =========================================================

create or replace function public.qwencloud_quota_reconcile(
    p_model_uuid uuid
)
returns void
language plpgsql
security definer
as $$
declare
    v_total integer;
    v_auto timestamptz;
    v_status text;
    v_used integer;
begin

    select
        q.total_seconds,
        q.auto_disabled_at,
        m.status
      into v_total, v_auto, v_status
      from public.model_quota q
      join public.models m
        on m.id = q.model_id
     where q.model_id = p_model_uuid;


    if v_total is null then
        return;
    end if;


    /*
     * Pelacakan dimatikan (total 0): kalau model pernah
     * dinonaktifkan otomatis, aktifkan kembali.
     */

    if v_total = 0 then

        if v_auto is not null then

            update public.models
               set status = 'active',
                   updated_at = now()
             where id = p_model_uuid
               and status = 'inactive';

            update public.model_quota
               set auto_disabled_at = null,
                   previous_status = null,
                   updated_at = now()
             where model_id = p_model_uuid;

        end if;

        return;

    end if;


    v_used :=
        public.qwencloud_used_seconds(
            p_model_uuid
        );


    /* ---------- kuota habis: nonaktifkan ---------- */

    if v_used >= v_total then

        if v_status is distinct from 'inactive' then

            update public.models
               set status = 'inactive',
                   updated_at = now()
             where id = p_model_uuid;

            update public.model_quota
               set auto_disabled_at =
                       coalesce(auto_disabled_at, now()),
                   previous_status =
                       coalesce(previous_status, v_status),
                   updated_at = now()
             where model_id = p_model_uuid;

        end if;

        return;

    end if;


    /* ---------- masih ada sisa: refund ---------- */

    if v_auto is not null then

        update public.models
           set status = 'active',
               updated_at = now()
         where id = p_model_uuid
           and status = 'inactive';

        update public.model_quota
           set auto_disabled_at = null,
               previous_status = null,
               updated_at = now()
         where model_id = p_model_uuid;

    end if;

end;
$$;


/*
 * Alias lama supaya pemanggil lama tetap jalan.
 */

create or replace function public.qwencloud_quota_recheck(
    p_model_uuid uuid
)
returns void
language plpgsql
security definer
as $$
begin
    perform public.qwencloud_quota_reconcile(
        p_model_uuid
    );
end;
$$;


/*
 * Sapu seluruh model QwenCloud. Dipanggil saat admin
 * membuka halaman Models supaya status aktif/nonaktif
 * selalu mengikuti pemakaian terbaru (termasuk refund).
 */

create or replace function public.qwencloud_quota_reconcile_all()
returns integer
language plpgsql
security definer
as $$
declare
    v_row record;
    v_count integer := 0;
begin

    for v_row in
        select model_id
          from public.model_quota
    loop

        perform public.qwencloud_quota_reconcile(
            v_row.model_id
        );

        v_count := v_count + 1;

    end loop;

    return v_count;

end;
$$;


-- =========================================================
-- 5. TRIGGER GENERATION HISTORY
--    Potong otomatis saat task dibuat, kembalikan otomatis
--    saat status berubah jadi gagal / batal.
-- =========================================================

create or replace function public.qwencloud_quota_after_generation()
returns trigger
language plpgsql
security definer
as $$
declare
    v_model_uuid uuid;
begin

    if lower(coalesce(new.provider_id, '')) <> 'qwencloud' then
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

        perform public.qwencloud_quota_reconcile(
            v_model_uuid
        );

    end if;


    return new;

end;
$$;


drop trigger if exists trg_qwencloud_quota
    on public.generation_history;

create trigger trg_qwencloud_quota
after insert or update of status, duration
    on public.generation_history
for each row
execute function public.qwencloud_quota_after_generation();


-- =========================================================
-- 6. RPC ADMIN (TANPA PEMAKAIAN MANUAL)
-- =========================================================

drop function if exists public.admin_set_model_quota(
    uuid,
    integer,
    date,
    integer,
    boolean
);

create or replace function public.admin_set_model_quota(
    p_model_uuid uuid,
    p_total_seconds integer,
    p_expires_at date default null,
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
        expires_at
    )
    values (
        p_model_uuid,
        greatest(coalesce(p_total_seconds, 0), 0),
        p_expires_at
    )
    on conflict (model_id) do update
    set total_seconds =
            greatest(coalesce(p_total_seconds, 0), 0),
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
     * Reset pemakaian = mulai dari nol dan aktifkan lagi
     * model yang dinonaktifkan otomatis.
     */

    if p_reset then

        update public.models
           set status = 'active',
               updated_at = now()
         where id = p_model_uuid
           and status = 'inactive';

    end if;


    perform public.qwencloud_quota_reconcile(
        p_model_uuid
    );

end;
$$;


-- =========================================================
-- 7. VERIFIKASI
-- =========================================================

-- select model_code, status, total_seconds, used_seconds,
--        remaining_seconds, remaining_percent,
--        expires_at, auto_disabled_at
-- from public.qwencloud_model_quota
-- order by model_code;
