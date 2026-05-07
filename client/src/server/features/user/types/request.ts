import type { Role } from "./response";

export interface UserCreateInput {
  userName: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: Role;
  password: string;
  phone?: string | null;
  profilePicture?: string | null;
  createdByUserId?: number | null;
  confirmPassword?: string;
  organizationId?: number;
}

export interface UserCreateResponse {
  id: number;
  userName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: Role;
  password: string;
  phone: string | null;
  profilePicture: string | null;
  createdByUserId: number | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UserUpdateInput {
  id?: number;
  userName?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  role?: Role;
  password?: string;
  phone?: string | null;
  profilePicture?: string | null;
  createdByUserId?: number | null;
  currentPassword?: string;
  confirmPassword?: string;
}

export interface ChangePasswordInput {
  userId: number;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
