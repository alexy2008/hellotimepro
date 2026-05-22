import { ColumnOptions, ValueTransformer } from 'typeorm';

const isSqlite = () => (process.env.DB_DRIVER || 'postgres') === 'sqlite';

const dateTransformer: ValueTransformer = {
  to: (v: Date | null | undefined) => {
    if (v == null) return null;
    return v instanceof Date ? v.toISOString() : v;
  },
  from: (v: string | null | undefined) => {
    if (v == null) return null;
    return typeof v === 'string' ? new Date(v) : v;
  },
};

export function timestampColumn(nullable = false): ColumnOptions {
  if (isSqlite()) {
    return { type: 'text', nullable, transformer: dateTransformer };
  }
  return { type: 'timestamptz', nullable };
}

export function uuidColumn(): ColumnOptions {
  if (isSqlite()) {
    return { type: 'text' } as ColumnOptions;
  }
  return { type: 'varchar', length: 36 } as ColumnOptions;
}

export function primaryUuidColumn(): { type: 'varchar' | 'text'; length?: number } {
  if (isSqlite()) {
    return { type: 'text' };
  }
  return { type: 'varchar', length: 36 };
}
