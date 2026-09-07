/**
 * A purpose-built fake, not a generic ORM mock — supports exactly the
 * chained query patterns actually used across lib/security/auth.ts,
 * lib/clinical/handlers.ts, and lib/clinical/persist-analysis.ts
 * (.select/.eq/.single/.maybeSingle/.insert/.order/.limit), backed by a
 * plain in-memory table of rows per table name. It deliberately ignores
 * which columns `.select()` asks for (returns whole stored rows) and
 * doesn't implement real PostgREST relational embedding — tests seed
 * embedded shapes (e.g. a `patients` object directly on a `cases` row)
 * where that's needed. That's the right amount of fidelity for testing
 * this codebase's branching logic; it is not trying to be a real Postgres.
 */

export interface FakeAuthUser {
  id: string;
  email: string;
}

export function createFakeSupabase(config: { tables?: Record<string, any[]>; authUser?: FakeAuthUser | null }) {
  const tables: Record<string, any[]> = config.tables ?? {};
  let insertCounter = 0;

  function matchesFilters(row: any, filters: [string, any][]): boolean {
    return filters.every(([col, val]) => row[col] === val);
  }

  function builder(table: string) {
    const filters: [string, any][] = [];
    let insertedRows: any[] | null = null;
    let orderCol: string | null = null;
    let orderAscending = true;
    let limitN: number | null = null;

    function resolveRows(): any[] {
      if (insertedRows) return insertedRows;
      let rows = (tables[table] ?? []).filter((r) => matchesFilters(r, filters));
      if (orderCol) {
        const col = orderCol;
        rows = [...rows].sort((a, b) => (orderAscending ? 1 : -1) * (a[col] > b[col] ? 1 : -1));
      }
      if (limitN != null) rows = rows.slice(0, limitN);
      return rows;
    }

    const api: any = {
      select() {
        return api;
      },
      eq(col: string, val: any) {
        filters.push([col, val]);
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAscending = opts?.ascending ?? true;
        return api;
      },
      limit(n: number) {
        limitN = n;
        return api;
      },
      insert(rows: any) {
        const arr = Array.isArray(rows) ? rows : [rows];
        tables[table] = tables[table] ?? [];
        insertedRows = arr.map((r: any) => {
          const withId = { id: `fake-id-${++insertCounter}`, ...r };
          tables[table]!.push(withId);
          return withId;
        });
        return api;
      },
      single() {
        const rows = resolveRows();
        if (rows.length !== 1) return Promise.resolve({ data: null, error: { message: "Row not found or ambiguous." } });
        return Promise.resolve({ data: rows[0], error: null });
      },
      maybeSingle() {
        const rows = resolveRows();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      // Supports `await supabase.from(x)...` without a terminal
      // .single()/.maybeSingle() — array-returning queries.
      then(onFulfilled: any, onRejected?: any) {
        return Promise.resolve({ data: resolveRows(), error: null }).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  return {
    from: (table: string) => builder(table),
    auth: {
      getUser: async () =>
        config.authUser
          ? { data: { user: config.authUser }, error: null }
          : { data: { user: null }, error: { message: "Not authenticated." } },
    },
  } as any;
}
