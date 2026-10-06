-- Chat: marca de entrega ("recibido"). Una persona la deja cuando su app abierta recibe mensajes de otros,
-- sin marcarlos como leidos. Vive junto a read_at en chat_reads, asi la suscripcion Realtime que ya escucha
-- esa tabla avisa tambien al emisor. Una fila solo con entrega tiene read_at nulo.

alter table public.chat_reads add column delivered_at timestamptz;
alter table public.chat_reads alter column read_at drop not null;

-- Igual que read_at: el cliente solo escribe las columnas de entrega de su propia fila (RLS existente).
grant insert (delivered_at), update (delivered_at) on public.chat_reads to authenticated;

-- ---------------------------------------------------------------------------
-- Guarda: ni lectura ni entrega retroceden, se borran o apuntan al futuro (1 minuto de tolerancia)
-- ---------------------------------------------------------------------------
create or replace function private.chat_reads_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.read_at > clock_timestamp() + interval '1 minute' then
    raise exception 'La lectura no puede estar en el futuro.';
  end if;
  if new.delivered_at > clock_timestamp() + interval '1 minute' then
    raise exception 'La entrega no puede estar en el futuro.';
  end if;
  if tg_op = 'UPDATE' then
    if (new.thread_id, new.user_id) is distinct from (old.thread_id, old.user_id) then
      raise exception 'Solo se puede cambiar read_at.';
    end if;
    if old.read_at is not null and (new.read_at is null or new.read_at < old.read_at) then
      raise exception 'La lectura no puede retroceder.';
    end if;
    if old.delivered_at is not null and (new.delivered_at is null or new.delivered_at < old.delivered_at) then
      raise exception 'La entrega no puede retroceder.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: marcar entregado con la hora del servidor (SECURITY INVOKER: aplica el RLS de la propia fila)
-- ---------------------------------------------------------------------------
create function public.chat_mark_delivered(p_thread uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if not public.chat_can_access(p_thread) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;
  insert into public.chat_reads (thread_id, user_id, delivered_at)
  values (p_thread, (select auth.uid()), clock_timestamp())
  on conflict (thread_id, user_id)
  do update set delivered_at = greatest(public.chat_reads.delivered_at, excluded.delivered_at);
end;
$$;

revoke execute on function public.chat_mark_delivered(uuid) from public, anon;
grant execute on function public.chat_mark_delivered(uuid) to authenticated;
