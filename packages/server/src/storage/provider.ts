export interface StorageProvider {
  name: string
  test(config: Record<string, string>): Promise<{ success: boolean; message: string }>
  upload(config: Record<string, string>, path: string, buffer: Buffer): Promise<string>
  delete(config: Record<string, string>, path: string): Promise<void>
}
