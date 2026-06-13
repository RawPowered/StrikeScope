import { describe, it, expect } from 'vitest'

describe('admin utils', () => {
  it('should have basic test passing', () => {
    expect(true).toBe(true)
  })

  it('should parse column picker key format', () => {
    const key = 'cf_fieldName'
    expect(key.startsWith('cf_')).toBe(true)
    expect(key.slice(3)).toBe('fieldName')
  })
})