/*
  Warnings:

  - You are about to drop the `plot_points` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('INTERSECTION', 'JEEPNEY_STOP', 'TODA_TERMINAL', 'LANDMARK');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('JEEPNEY', 'TODA', 'WALK');

-- CreateEnum
CREATE TYPE "JeepneyColor" AS ENUM ('YELLOW', 'BLUE', 'RED', 'GREEN');

-- DropTable
DROP TABLE "plot_points";

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "NodeType" NOT NULL,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(11,8) NOT NULL,
    "landmark_alias" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jeepney_routes" (
    "id" TEXT NOT NULL,
    "color_code" "JeepneyColor" NOT NULL,
    "route_name" TEXT NOT NULL,
    "base_fare" DECIMAL(5,2) NOT NULL,
    "fare_per_km" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jeepney_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "stop_order" INTEGER NOT NULL,

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toda_zones" (
    "id" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "terminal_node_id" TEXT NOT NULL,
    "base_fare" DECIMAL(5,2) NOT NULL,
    "fare_per_km" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toda_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edges" (
    "id" TEXT NOT NULL,
    "from_node_id" TEXT NOT NULL,
    "to_node_id" TEXT NOT NULL,
    "transport_mode" "TransportMode" NOT NULL,
    "distance_m" DECIMAL(10,2) NOT NULL,
    "travel_time_min" DECIMAL(5,2) NOT NULL,
    "estimated_fare" DECIMAL(6,2) NOT NULL,
    "transfer_penalty" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "jeepney_route_id" TEXT,
    "toda_zone_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fare_matrix" (
    "id" TEXT NOT NULL,
    "transport_mode" "TransportMode" NOT NULL,
    "min_km" DECIMAL(5,2) NOT NULL,
    "max_km" DECIMAL(5,2) NOT NULL,
    "fare_amount" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "fare_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landmarks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "geofence_radius_m" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "landmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_stops_route_id_stop_order_key" ON "route_stops"("route_id", "stop_order");

-- CreateIndex
CREATE UNIQUE INDEX "toda_zones_terminal_node_id_key" ON "toda_zones"("terminal_node_id");

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "jeepney_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toda_zones" ADD CONSTRAINT "toda_zones_terminal_node_id_fkey" FOREIGN KEY ("terminal_node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_jeepney_route_id_fkey" FOREIGN KEY ("jeepney_route_id") REFERENCES "jeepney_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_toda_zone_id_fkey" FOREIGN KEY ("toda_zone_id") REFERENCES "toda_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landmarks" ADD CONSTRAINT "landmarks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
