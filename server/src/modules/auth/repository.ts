import type { PrismaClient } from "../../../generated/prisma/client";

export class AuthRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: number) {
    const data = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!data) return null;

    return {
      ...data,
    };
  }
}
