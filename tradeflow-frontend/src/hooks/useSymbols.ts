import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useAvailableSymbols() {
  return useQuery({
    queryKey: ['symbols'],
    queryFn: () => apiClient.getAvailableSymbols(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['symbol-search', query],
    queryFn: () => apiClient.searchSymbols(query),
    enabled: query.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useSymbolInfo(symbol: string) {
  return useQuery({
    queryKey: ['symbol-info', symbol],
    queryFn: () => apiClient.getSymbolInfo(symbol),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}