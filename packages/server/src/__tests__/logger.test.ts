import { describe, it, expect, vi } from 'vitest'
import logger from '../logger.js'

describe('logger', () => {
  it('should export a pino logger instance', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('should log info messages', () => {
    const spy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    logger.info('test message')
    expect(spy).toHaveBeenCalledWith('test message')
    spy.mockRestore()
  })

  it('should log error messages with error objects', () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const err = new Error('test error')
    logger.error({ err }, 'error message')
    expect(spy).toHaveBeenCalledWith({ err }, 'error message')
    spy.mockRestore()
  })
})