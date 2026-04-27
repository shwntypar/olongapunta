import { asyncHandler } from "../../core/middleware/error-handler.middleware";
import { sendResponse } from "../../core/utils/response";
import type { AuthService } from "./service";
import type { Request, Response } from "express";

export class AuthController {
  private service: AuthService;

  constructor(service: AuthService) {
    this.service = service;
  }

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const { user, token } = await this.service.login(email, password, res);

    return sendResponse(
      res,
      {
        id: user.id,
        email: user.email,
        token,
      },
      201,
      "Login successful",
    );
  });
}
