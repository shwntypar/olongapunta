import type { PrismaClient, Prisma } from "../../../../generated/prisma/client";

export class AmenitiesRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // async findMany() {
  //   return this.prisma.landmark.findMany({
  //     where: {
  //       node: {
  //         lat: {
  //           gte: (lat - latDelta).toString(),
  //           lte: (lat + latDelta).toString(),
  //         },
  //         lng: {
  //           gte: (lng - lngDelta).toString(),
  //           lte: (lng + lngDelta).toString(),
  //         },
  //       },
  //     },
  //   });
  // }

  async existingLandmarks(osmIds: string[]) {
    return this.prisma.landmark.findMany({
      where: {
        osmId: {
          in: osmIds,
        },
      },
    });
  }

  async landMarksCount(category?: string) {
    return this.prisma.landmark.count({
      where: category ? { category } : undefined,
    });
  }

  async createLandmark(data: Prisma.LandmarkCreateInput) {
    return this.prisma.landmark.create({
      data,
    });
  }

  async createMany(
    data: Prisma.LandmarkCreateManyInput[],
  ): Promise<Prisma.BatchPayload> {
    if (data.length === 0) return { count: 0 };

    return this.prisma.landmark.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
