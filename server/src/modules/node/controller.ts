import type { Request, Response, NextFunction } from "express";
import { NodeService } from "./service";
import { AppError } from "../../core/utils/error";
import type { CreateNodeDTO, UpdateNodeDTO } from "./types";
import { asyncHandler } from "../../core/middleware/error-handler.middleware";
import { sendResponse } from "../../core/utils/response";

export class NodeController {
  private service: NodeService;

  constructor(service: NodeService) {
    this.service = service;
  }

  createNode = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, description, type, lat, lng, landmarkAlias } = req.body;

        const createNodeDTO: CreateNodeDTO = {
          name,
          description,
          type,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          landmarkAlias,
        };

        const node = await this.service.createNode(createNodeDTO);

        return sendResponse(res, node, 201, "Node created successfully");
      } catch (error) {
        next(error);
      }
    },
  );

  getAllNodes = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const nodes = await this.service.getAllNodes();

        return sendResponse(res, nodes, 200);
      } catch (error) {
        next(error);
      }
    },
  );

  getNodeById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!id) {
          throw new AppError("Node ID is required", 400);
        }

        const node = await this.service.getNodeById(id?.toString());

        return sendResponse(res, node, 200);
      } catch (error) {
        next(error);
      }
    },
  );

  updateNode = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { name, description, type, lat, lng, landmarkAlias } = req.body;

        if (!id) {
          throw new AppError("Node ID is required", 400);
        }

        const updateNodeDTO: UpdateNodeDTO = {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(lat !== undefined && { lat: parseFloat(lat) }),
          ...(lng !== undefined && { lng: parseFloat(lng) }),
          ...(landmarkAlias !== undefined && { landmarkAlias }),
        };

        const node = await this.service.updateNode(
          id.toString(),
          updateNodeDTO,
        );

        return sendResponse(res, node, 200, "Node updated successfully");
      } catch (error) {
        next(error);
      }
    },
  );

  deleteNode = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!id) {
          throw new AppError("Node ID is required", 400);
        }

        const result = await this.service.deleteNode(id.toString());

        return sendResponse(res, result, 200);
      } catch (error) {
        next(error);
      }
    },
  );
}
