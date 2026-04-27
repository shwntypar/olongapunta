import axiosInstance from "@/server/helper/axiosInstance";
import {
  UserCreateInput,
  UserCreateResponse,
  UserResponse,
  UsersResponse,
  UserUpdateInput,
  ChangePasswordInput,
} from "./types";

export const createUser = async (
  user: UserCreateInput,
): Promise<UserCreateResponse> => {
  const response = await axiosInstance.post("user/", user);
  return response.data;
};

export const getCurrentUser = async (): Promise<UserResponse> => {
  const response = await axiosInstance.get("user/");
  return response.data;
};

export const getUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  orderField?: string;
  orderBy?: "asc" | "desc";
}): Promise<UsersResponse> => {
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.append("page", params.page.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.search) queryParams.append("search", params.search);
  if (params?.role) queryParams.append("role", params.role);
  if (params?.orderField) queryParams.append("orderField", params.orderField);
  if (params?.orderBy) queryParams.append("orderBy", params.orderBy);

  const queryString = queryParams.toString();
  const url = queryString ? `/user/many?${queryString}` : "user/many";

  const response = await axiosInstance.get(url);
  return response.data;
};

export const getUserById = async (userId: number): Promise<UserResponse> => {
  const response = await axiosInstance.get(`/user/${userId}`);
  return response.data;
};

export const updateUser = async (
  userId: number,
  userData: UserUpdateInput,
): Promise<UserResponse> => {
  const response = await axiosInstance.put(`/user/${userId}`, userData);
  return response.data;
};

export const deleteUser = async (userId: number): Promise<UserResponse> => {
  const response = await axiosInstance.delete(`/user/${userId}`);
  return response.data;
};

export const uploadProfilePicture = async (
  userId: number,
  file: File,
): Promise<UserResponse> => {
  const formData = new FormData();
  formData.append("profilePicture", file);

  const response = await axiosInstance.post(
    `/user/${userId}/picture`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
};

export const changePassword = async (
  userId: number,
  passwordData: Omit<ChangePasswordInput, "userId">,
): Promise<UserResponse> => {
  const response = await axiosInstance.put(
    `/user/${userId}/change-password`,
    passwordData,
  );
  return response.data;
};
