import {
  login,
  logout,
  requestPasswordReset,
  resetPassword,
} from "@/server/features/auth";
import { LoginResponse } from "@/server/features/auth/types";
import { AUTH_KEYS, USERS } from "@/utils/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (data: LoginResponse) => {
      queryClient.invalidateQueries({ queryKey: [AUTH_KEYS.CHECK_AUTH] });
      queryClient.invalidateQueries({ queryKey: [USERS.CURRENT_USER] });

      if (data.id) {
        queryClient.setQueryData([AUTH_KEYS.CHECK_AUTH], data);
      }

      toast.success("Login successful!", {
        description: `Welcome back, ${data.userName}!`,
        position: "top-right",
        duration: 5000,
        closeButton: true,
      });
    },
    onError: (error: any) => {
      toast.error("Login failed!", {
        description: error.message || "Invalid email or password",
        position: "top-right",
        duration: 5000,
        style: { backgroundColor: "red" },
        closeButton: true,
      });
      console.error("Login error:", error);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      // Clear persisted station filter keys so filters don't leak between users/tabs
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.removeItem("kloudtrack.selectedStation");
        }
      } catch {
        // ignore storage errors
      }

      toast.success("Logged out successfully!", {
        description: "You have been logged out",
        position: "top-right",
        duration: 3000,
        closeButton: true,
      });

      window.location.reload();
    },
    onError: (error: any) => {
      toast.error("Logout failed!", {
        description: error.message || "An error occurred during logout",
        position: "top-right",
        duration: 5000,
        style: { backgroundColor: "red" },
        closeButton: true,
      });
      console.error("Logout error:", error);
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => {
      toast.success("Password reset email sent!", {
        description: "Check your email for the verification code",
        position: "top-right",
        duration: 8000,
        closeButton: true,
      });
    },
    onError: (error: any) => {
      toast.error("Password reset request failed!", {
        description: error.message || "Failed to send password reset email",
        position: "top-right",
        duration: 5000,
        style: { backgroundColor: "red" },
        closeButton: true,
      });
      console.error("Password reset request error:", error);
    },
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      queryClient.clear();

      toast.success("Password reset successful!", {
        description:
          "Your password has been updated. Please login with your new password.",
        position: "top-right",
        duration: 8000,
        closeButton: true,
      });

      setTimeout(() => {
        window.location.reload();
      }, 1800);
    },
    onError: (error: any) => {
      toast.error("Password reset failed!", {
        description: error.message || "Invalid or expired verification code",
        position: "top-right",
        duration: 5000,
        style: { backgroundColor: "red" },
        closeButton: true,
      });
      console.error("Password reset error:", error);
    },
  });
}
