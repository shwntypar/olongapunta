export type Role = "ADMIN" | "SUPERADMIN" | "USER";

export interface UserDetails {
  id: number;
  userName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: Role;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UserResponse {
  id: number;
  userName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UsersResponsePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface UsersResultsResponse {
  totalAccounts: number;
  totalAdmins: number;
  totalSuperadmins: number;
  totalUsers: number;
}

export interface UsersResponse {
  users: UserResponse[];
  results: UsersResultsResponse;
  pagination: UsersResponsePagination;
}

export type UserStatusEnum = "online" | "away" | "offline";
