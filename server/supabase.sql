-- 공마일(0MILE) · Supabase 설정 (SQL Editor에서 통째로 실행, 여러 번 실행해도 안전)
-- 데이터는 platform_items 한 테이블에 저장되고, 브라우저는 아래 함수(RPC)로만 접근합니다.
-- 같은 "작업공간 코드"를 입력한 사람끼리 같은 데이터를 봅니다. 코드는 비밀번호처럼 관리하세요.

create table if not exists public.platform_items (
  workspace  text        not null,
  col        text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace, col, id)
);

create index if not exists platform_items_list_idx
  on public.platform_items (workspace, col, updated_at desc);

-- 테이블 직접 접근 차단: RLS 켜고 정책은 만들지 않음 + 권한 회수
alter table public.platform_items enable row level security;
revoke all on table public.platform_items from anon, authenticated, public;

-- 작업공간 코드 검사
create or replace function public._p_check(p_workspace text)
returns void
language plpgsql
as $$
begin
  if p_workspace is null or length(p_workspace) < 8 then
    raise exception '작업공간 코드는 8자 이상이어야 합니다.' using errcode = '28000';
  end if;
end;
$$;

create or replace function public.p_get(p_workspace text, p_col text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public._p_check(p_workspace);
  select data into v from public.platform_items
   where workspace = p_workspace and col = p_col and id = p_id;
  return v;
end;
$$;

create or replace function public.p_put(p_workspace text, p_col text, p_id text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._p_check(p_workspace);
  if p_col is null or p_id is null or length(p_col) = 0 or length(p_id) = 0 then
    raise exception '컬렉션과 id가 필요합니다.';
  end if;
  if pg_column_size(p_data) > 20 * 1024 * 1024 then
    raise exception '데이터가 너무 큽니다(20MB 초과).';
  end if;
  insert into public.platform_items (workspace, col, id, data, updated_at)
  values (p_workspace, p_col, p_id, coalesce(p_data, 'null'::jsonb), now())
  on conflict (workspace, col, id)
  do update set data = excluded.data, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.p_list(p_workspace text, p_col text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public._p_check(p_workspace);
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'data', data, 'updated_at', updated_at)
                            order by updated_at desc), '[]'::jsonb)
    into v
    from public.platform_items
   where workspace = p_workspace and col = p_col;
  return v;
end;
$$;

create or replace function public.p_remove(p_workspace text, p_col text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._p_check(p_workspace);
  delete from public.platform_items
   where workspace = p_workspace and col = p_col and id = p_id;
end;
$$;

-- 작업공간의 컬렉션 목록(연결 확인·전체 복사·백업에 사용)
create or replace function public.p_cols(p_workspace text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public._p_check(p_workspace);
  select coalesce(jsonb_agg(distinct col), '[]'::jsonb) into v
    from public.platform_items where workspace = p_workspace;
  return v;
end;
$$;

-- 실행 권한: 함수만 공개
revoke all on function public._p_check(text) from public, anon, authenticated;
revoke all on function public.p_get(text, text, text) from public;
revoke all on function public.p_put(text, text, text, jsonb) from public;
revoke all on function public.p_list(text, text) from public;
revoke all on function public.p_remove(text, text, text) from public;
revoke all on function public.p_cols(text) from public;
grant execute on function public.p_get(text, text, text) to anon, authenticated;
grant execute on function public.p_put(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.p_list(text, text) to anon, authenticated;
grant execute on function public.p_remove(text, text, text) to anon, authenticated;
grant execute on function public.p_cols(text) to anon, authenticated;
