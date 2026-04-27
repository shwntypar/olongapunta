import { Router } from "express";
import type { NodeController } from "./controller";
import { validateRequest } from "../../core/middleware/validation";
import { NodesValidation } from "./validation";

export class NodeRoutes {
  private router: Router;
  private controller: NodeController;

  constructor(nodeController: NodeController) {
    this.router = Router();
    this.controller = nodeController;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      "/",
      validateRequest(NodesValidation),
      this.controller.createNode.bind(this),
    );

    this.router.get("/", this.controller.getAllNodes.bind(this));

    this.router.get("/:id", this.controller.getNodeById.bind(this));

    this.router.patch("/:id", this.controller.updateNode.bind(this));

    this.router.delete("/:id", this.controller.deleteNode.bind(this));
  }

  public getRouter(): Router {
    return this.router;
  }
}
