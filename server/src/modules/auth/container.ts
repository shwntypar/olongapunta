import type { PrismaClient } from "../../../generated/prisma/client";
import { AuthController } from "./controller";
import { AuthRepository } from "./repository";
import { AuthRoutes } from "./routes";
import { AuthService } from "./service";

export class AuthContainer {
  public readonly repository: AuthRepository;
  public readonly service: AuthService;
  public readonly controller: AuthController;
  public readonly routes: AuthRoutes;

  constructor(prisma: PrismaClient) {
    this.repository = new AuthRepository(prisma);
    this.service = new AuthService(this.repository);
    this.controller = new AuthController(this.service);
    this.routes = new AuthRoutes(this.controller);
  }
}
