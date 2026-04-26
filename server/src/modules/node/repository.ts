import { PrismaClient, Prisma } from "../../../generated/prisma/client";

export class PlotPointRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createPlotPoint(data: Prisma.NodeCreateInput) {
    return this.prisma.node.create({ data });
  }

  async findAll() {
    return this.prisma.node.findMany();
  }
}
