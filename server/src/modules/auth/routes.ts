import { Router } from "express";
import type { AuthController } from "./controller";
import { validateRequest } from "../../core/middleware/validation";
import { LoginValidation } from "./validation";

export class AuthRoutes {
  private controller: AuthController;
  private router: Router;

  constructor(controller: AuthController) {
    this.controller = controller;
    this.router = Router();

    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      "/login",
      validateRequest(LoginValidation),
      this.controller.login.bind(this),
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
