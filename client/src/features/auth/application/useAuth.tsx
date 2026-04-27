import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  UserProfileResponse,
  LoginInput,
  LoginResponse,
} from "@/server/features/auth/types";
import { useLogin, useLogout } from "./authMutation";
import { useCheckAuth } from "./authQueries";
import { UserResponse } from "@/server/features/user/types";
import { useGetCurrentUser } from "@/features/user/application/userQueries";

export interface AuthContext {
  isAuthenticated: boolean;
  user: UserResponse | undefined;
  authUser: UserProfileResponse | undefined;
  isAuthLoading: boolean;
  isUserDataLoading: boolean;
  login: (credentials: LoginInput) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  isLoginLoading: boolean;
  isLogoutLoading: boolean;
}

const AuthContext = React.createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: authUser, isLoading: isAuthLoading } = useCheckAuth();
  const { data: user, isLoading: isUserLoading } = useGetCurrentUser();

  const isAuthenticated = !!authUser;
  const isLoading = isAuthLoading;
  const isUserDataLoading = isAuthenticated && isUserLoading;

  const { mutateAsync: login, isPending: isLoginLoading } = useLogin();
  const { mutateAsync: logout, isPending: isLogoutLoading } = useLogout();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        authUser,
        isAuthLoading,
        isUserDataLoading,
        login,
        logout,
        isLoginLoading,
        isLogoutLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
