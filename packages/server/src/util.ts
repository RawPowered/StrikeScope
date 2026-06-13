import type { Request, Response, NextFunction } from 'express'

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function snakeToCamel<T = any>(row: Record<string, any> | null): T | null {
  if (!row) return null
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = val
  }
  return result as T
}

export function mapRows<T = any>(rows: Record<string, any>[]): T[] {
  return rows.map(r => snakeToCamel<T>(r)!)
}

export function mapSubmissionRow(row: Record<string, any>): any {
  if (!row) return null
  return {
    ...snakeToCamel(row),
    photos: undefined,
    photoCount: row.photoCount ?? row.photo_count,
  }
}
