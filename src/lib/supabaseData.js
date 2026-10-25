import { supabase } from "@/lib/supabase";

function throwIfError(error) {
  if (error) throw error;
}

/** @param {Array<Record<string, any>> | null} rows */
function mapRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    created_date: row.created_at ?? row.created_date,
  }));
}

/** @returns {Promise<Array<Record<string, any>>>} */
export async function selectRows(table, filters = {}, options = {}) {
  let query = supabase.from(table).select("*");
  for (const [column, value] of Object.entries(filters)) {
    query = Array.isArray(value)
      ? query.in(column, value)
      : query.eq(column, value);
  }
  if (options.sort) {
    const descending = options.sort.startsWith("-");
    query = query.order(descending ? options.sort.slice(1) : options.sort, { ascending: !descending });
  }
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  throwIfError(error);
  return mapRows(data);
}

export async function selectRow(table, id) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
  throwIfError(error);
  return { ...data, created_date: data.created_at ?? data.created_date };
}

export async function insertRow(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select("*").single();
  throwIfError(error);
  return { ...data, created_date: data.created_at ?? data.created_date };
}

export async function updateRow(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("*").single();
  throwIfError(error);
  return { ...data, created_date: data.created_at ?? data.created_date };
}

export async function updateRows(table, ids, values) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from(table).update(values).in("id", ids).select("*");
  throwIfError(error);
  return mapRows(data);
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  throwIfError(error);
}
