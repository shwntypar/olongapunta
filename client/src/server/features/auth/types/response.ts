export interface LoginResponse {
  id: number;
  userName: string;
  email: string;
  role: "ADMIN" | "USER" | "SUPERADMIN";
  token: string;
}

export interface UserProfileResponse {
  id: number;
  userName: string;
  email: string;
  role: "ADMIN" | "USER" | "SUPERADMIN";
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
  organizationId?: number;
}
