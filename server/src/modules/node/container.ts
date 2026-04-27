import type { PrismaClient } from "../../../generated/prisma/client";
import { NodeController } from "./controller";
import { NodeService } from "./service";
import { NodeRoutes } from "./routes";
import { NodeRepository } from "./repository";

export class NodeContainer {
  private repository: NodeRepository;
  private nodeService: NodeService;
  private nodeController: NodeController;
  public routes: NodeRoutes;

  constructor(prisma: PrismaClient) {
    this.repository = new NodeRepository(prisma);
    this.nodeService = new NodeService(this.repository);
    this.nodeController = new NodeController(this.nodeService);
    this.routes = new NodeRoutes(this.nodeController);
  }
}
