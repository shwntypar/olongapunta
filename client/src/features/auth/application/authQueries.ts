import { checkAuth } from "@/server/features/auth";
import { UserProfileResponse } from "@/server/features/auth/types";
import { AUTH_KEYS } from "@/utils/queryKeys";
import { useQuery, queryOptions, UseQueryResult } from "@tanstack/react-query";

export const checkAuthQueryOptions = () =>
  queryOptions({
    queryKey: [AUTH_KEYS.CHECK_AUTH],
    queryFn: checkAuth,
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

export const useCheckAuth = (): UseQueryResult<UserProfileResponse> => {
  return useQuery(checkAuthQueryOptions());
};
