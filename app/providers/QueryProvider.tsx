import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, refetchOnWindowFocus: false }
        }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
