import type { StorageProvider } from './provider.js'
import { filesystemProvider } from './filesystem.js'
import { sshProvider } from './ssh.js'
import { ftpProvider } from './ftp.js'
import { s3Provider } from './s3.js'

const providers: Record<string, StorageProvider> = {
  filesystem: filesystemProvider,
  ssh: sshProvider,
  ftp: ftpProvider,
  'aws-s3': s3Provider,
}

export function getProvider(type: string): StorageProvider | undefined {
  return providers[type]
}

export function registerProvider(type: string, provider: StorageProvider) {
  providers[type] = provider
}

export { filesystemProvider } from './filesystem.js'
export { sshProvider } from './ssh.js'
export { ftpProvider } from './ftp.js'
export { s3Provider } from './s3.js'
