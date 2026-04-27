import axiosInstance from "@/server/helper/axiosInstance";
import {
  LoginInput,
  LoginResponse,
  UserProfileResponse,
  RequestPasswordResetInput,
  ResetPasswordInput,
} from "./types";

export const login = async (
  credentials: LoginInput,
): Promise<LoginResponse> => {
  const response = await axiosInstance.post("/auth/login", credentials);
  return response.data;
};

export const logout = async (): Promise<void> => {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
};

export const checkAuth = async (): Promise<UserProfileResponse> => {
  const response = await axiosInstance.get("/auth/check-auth");
  return response.data;
};

export const requestPasswordReset = async (
  data: RequestPasswordResetInput,
): Promise<void> => {
  const response = await axiosInstance.post(
    "/auth/password-reset/request",
    data,
  );
  return response.data;
};

export const resetPassword = async (
  data: ResetPasswordInput,
): Promise<void> => {
  const response = await axiosInstance.post("/auth/password-reset", data);
  return response.data;
};
