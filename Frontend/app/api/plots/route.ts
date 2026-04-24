import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const plots = await prisma.plot.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(plots);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, lat, lng } = body;

  if (!name || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "Please send name, lat, and lng fields with correct types." },
      { status: 400 }
    );
  }

  const plot = await prisma.plot.create({
    data: {
      name,
      lat,
      lng,
    },
  });

  return NextResponse.json(plot, { status: 201 });
}
