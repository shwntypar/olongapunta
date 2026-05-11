import { PrismaClient } from "../../../../generated/prisma/client";
import { NodeRepository } from "../repository";
import { AmenitiesController } from "./controller";
import { AmenitiesRepository } from "./repository";
import { AmenitiesRoutes } from "./routes";
import { AmenitiesService } from "./service";

export class AmenitiesContainer {
  private service: AmenitiesService;
  private controller: AmenitiesController;
  private repository: AmenitiesRepository;
  public routes: AmenitiesRoutes;
  private node: NodeRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new AmenitiesRepository(prisma);
    this.node = new NodeRepository(prisma);
    this.service = new AmenitiesService(this.repository, this.node);
    this.controller = new AmenitiesController(this.service);
    this.routes = new AmenitiesRoutes(this.controller);
  }
}
