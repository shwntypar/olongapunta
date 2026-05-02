import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../core/utils/error";
import type {
  PaginatedResult,
  PaginationOptions,
} from "../../utils/pagination.response";
import type { NodeRepository } from "./repository";
import type { CreateNodeDTO, NodeResponse, UpdateNodeDTO } from "./types";

export class NodeService {
  private repository: NodeRepository;
  constructor(repository: NodeRepository) {
    this.repository = repository;
  }

  async createNode(data: CreateNodeDTO) {
    try {
      const createData: Prisma.NodeCreateInput = {
        name: data.name,
        description: data.description,
        type: data.type,
        lat: data.lat,
        lng: data.lng,
        landmarkAlias: data.landmarkAlias,
      };

      const node = await this.repository.create(createData);

      return node;
    } catch (error) {
      throw new AppError("Failed to create node", 500);
    }
  }

  async getAllNodes(
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<NodeResponse>> {
    try {
      return await this.repository.findManyPaginated(options);
    } catch (error) {
      throw new AppError("Failed to fetch nodes", 500);
    }
  }

  async getNodeById(id: string) {
    try {
      const node = await this.repository.findUnique(id);

      if (!node) {
        throw new AppError("Node not found", 404);
      }

      return node;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to fetch node", 500);
    }
  }

  async updateNode(id: string, data: UpdateNodeDTO) {
    try {
      const node = await this.repository.findUnique(id);

      if (!node) {
        throw new AppError("Node not found", 404);
      }

      const updateData: Prisma.NodeUpdateInput = {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.type && { type: data.type }),
        ...(data.lat !== undefined && { lat: data.lat }),
        ...(data.lng !== undefined && { lng: data.lng }),
        ...(data.landmarkAlias !== undefined && {
          landmarkAlias: data.landmarkAlias,
        }),
      };

      return await this.repository.update(id, updateData);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to update node", 500);
    }
  }

  async deleteNode(id: string) {
    try {
      const node = await this.repository.findUnique(id);

      if (!node) {
        throw new AppError("Node not found", 404);
      }

      await this.repository.delete(id);

      return { message: "Node deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to delete node", 500);
    }
  }
}
