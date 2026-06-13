import { Client } from 'ssh2'
import { dirname } from 'path'
import type { StorageProvider } from './provider.js'

function parseSshConfig(config: Record<string, string>) {
  return {
    host: config.host || 'localhost',
    port: parseInt(config.port) || 22,
    username: config.username || 'root',
    password: config.password || undefined,
    privateKey: config.privateKey || undefined,
    remoteDir: config.remoteDir || '/upload',
  }
}

export const sshProvider: StorageProvider = {
  name: 'ssh',

  async test(config: Record<string, string>) {
    const cfg = parseSshConfig(config)
    return new Promise((resolve) => {
      const conn = new Client()
      conn.on('ready', () => {
        conn.exec(`ls -la "${cfg.remoteDir}"`, (err, stream) => {
          conn.end()
          if (err) return resolve({ success: false, message: err.message })
          resolve({ success: true, message: `SSH connected to ${cfg.host}:${cfg.port}, directory accessible` })
        })
      })
      conn.on('error', (err) => {
        resolve({ success: false, message: err.message })
      })
      conn.connect({
        host: cfg.host, port: cfg.port, username: cfg.username,
        password: cfg.password, privateKey: cfg.privateKey,
      })
    })
  },

  async upload(config: Record<string, string>, filePath: string, buffer: Buffer) {
    const cfg = parseSshConfig(config)
    const remotePath = `${cfg.remoteDir}/${filePath}`.replace(/\\/g, '/')
    const remoteDir = dirname(remotePath)

    return new Promise((resolve, reject) => {
      const conn = new Client()
      conn.on('ready', () => {
        conn.exec(`mkdir -p "${remoteDir}"`, (err) => {
          if (err) { conn.end(); return reject(new Error(err.message)) }
          conn.sftp((sftpErr, sftp) => {
            if (sftpErr) { conn.end(); return reject(new Error(sftpErr.message)) }
            const ws = sftp.createWriteStream(remotePath)
            ws.on('error', (e: any) => { conn.end(); reject(e) })
            ws.on('close', () => { conn.end(); resolve(remotePath) })
            ws.write(buffer)
            ws.end()
          })
        })
      })
      conn.on('error', (err) => reject(err))
      conn.connect({
        host: cfg.host, port: cfg.port, username: cfg.username,
        password: cfg.password, privateKey: cfg.privateKey,
      })
    })
  },

  async delete(config: Record<string, string>, filePath: string) {
    const cfg = parseSshConfig(config)
    const remotePath = `${cfg.remoteDir}/${filePath}`.replace(/\\/g, '/')

    return new Promise((resolve, reject) => {
      const conn = new Client()
      conn.on('ready', () => {
        conn.sftp((sftpErr, sftp) => {
          if (sftpErr) { conn.end(); return reject(new Error(sftpErr.message)) }
          sftp.unlink(remotePath, (err) => {
            conn.end()
            if (err) reject(err)
            else resolve()
          })
        })
      })
      conn.on('error', (err) => reject(err))
      conn.connect({
        host: cfg.host, port: cfg.port, username: cfg.username,
        password: cfg.password, privateKey: cfg.privateKey,
      })
    })
  },
}
