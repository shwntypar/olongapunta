export interface LoginInput {
  email: string;
  password: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ResetPasswordInput {
  code: string;
  newPassword: string;
}
