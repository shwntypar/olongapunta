import { getCurrentUser, getUsers, getUserById } from "@/server/features/user";
import { UserResponse, UsersResponse } from "@/server/features/user/types";
import { USERS } from "@/utils/queryKeys";
import { queryOptions, UseQueryResult, useQuery } from "@tanstack/react-query";

export const getCurrentUserQueryOptions = () =>
  queryOptions({
    queryKey: [USERS.CURRENT_USER],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

export const useGetCurrentUser = (): UseQueryResult<UserResponse> => {
  return useQuery(getCurrentUserQueryOptions());
};

export const getUsersQueryOptions = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  orderField?: string;
  orderBy?: "asc" | "desc";
}) =>
  queryOptions({
    queryKey: [USERS.USERS_LIST, params],
    queryFn: () => getUsers(params),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

export const useGetUsers = (
  params?: Parameters<typeof getUsersQueryOptions>[0],
): UseQueryResult<UsersResponse> => {
  return useQuery(getUsersQueryOptions(params));
};

export const getUserByIdQueryOptions = (userId: number) =>
  queryOptions({
    queryKey: [USERS.USER_DETAIL, userId],
    queryFn: () => getUserById(userId),
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && userId > 0,
  });

export const useGetUserById = (
  userId: number,
): UseQueryResult<UserResponse> => {
  return useQuery(getUserByIdQueryOptions(userId));
};
