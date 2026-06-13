import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../queryClient.js'

interface Props {
  children: React.ReactNode
}

export default function QueryProvider({ children }: Props) {
  const [client] = useState(() => queryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}