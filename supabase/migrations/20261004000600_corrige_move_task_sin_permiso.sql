-- Corrige move_task: bajo RLS, quien no es el responsable ve la tarea pero su UPDATE no toca
-- ninguna fila y la funcion devolvia un registro vacio sin error. Ahora falla con el mismo
-- mensaje que el mock (tasks.move).
create or replace function public.move_task(p_id uuid, p_status public.task_status)
returns public.tasks
language plpgsql security invoker set search_path = ''
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_id;
  if not found then
    raise exception 'La tarea no existe';
  end if;
  if t.status = p_status then
    return t;
  end if;
  update public.tasks set status = p_status where id = p_id returning * into t;
  if not found then
    raise exception 'Solo puedes trabajar en tus tareas asignadas';
  end if;
  return t;
end;
$$;
