import bcrypt from "bcryptjs";
import { AppError } from "../../core/utils/error";
import type { AuthRepository } from "./repository";
import { generateToken } from "../../core/utils/auth";
import type { Response } from "express";

export class AuthService {
  private repository: AuthRepository;

  constructor(repository: AuthRepository) {
    this.repository = repository;
  }

  async login(email: string, password: string, res: Response) {
    const user = await this.repository.findByEmail(email);

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = generateToken(user.id, res);

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    };
  }
}
