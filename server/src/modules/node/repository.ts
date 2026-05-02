import { PrismaClient, Prisma } from "../../../generated/prisma/client";
import type {
  PaginatedResult,
  PaginationOptions,
} from "../../utils/pagination.response";

export class NodeRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: Prisma.NodeCreateInput) {
    return this.prisma.node.create({ data });
  }

  async findManyPaginated(
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;
    const totalItems = await this.prisma.node.count();

    const data = await this.prisma.node.findMany({
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
      },
    };
  }

  async findUnique(id: string) {
    return this.prisma.node.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Prisma.NodeUpdateInput) {
    return this.prisma.node.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.node.delete({
      where: { id },
    });
  }
}
