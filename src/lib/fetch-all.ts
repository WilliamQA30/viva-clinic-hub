/**
 * O PostgREST do Supabase devolve no máximo 1000 linhas por requisição
 * (max-rows do projeto). Consultas sem filtro de período em tabelas que
 * já passaram disso (ex: professional_payments) vinham truncadas em
 * silêncio — as linhas mais recentes ficavam de fora e os relatórios
 * saíam zerados/errados.
 *
 * `fetchAll` busca todas as páginas. Recebe uma função que monta a query
 * (com select/filtros/order) e paginando com `.range()`. Acrescenta
 * `order("id")` como desempate, senão a paginação pode pular/duplicar
 * linhas quando a ordenação principal não é única.
 */
const PAGE_SIZE = 1000;

export async function fetchAll<T = any>(
  build: () => any,
): Promise<{ data: T[]; error: any }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build()
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...((data as T[]) || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
