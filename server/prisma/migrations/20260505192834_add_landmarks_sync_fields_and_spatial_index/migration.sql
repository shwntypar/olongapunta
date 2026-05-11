/*
  Warnings:

  - A unique constraint covering the columns `[osm_id]` on the table `landmarks` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `osm_id` to the `landmarks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `osm_type` to the `landmarks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `landmarks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "landmarks" DROP CONSTRAINT "landmarks_node_id_fkey";

-- AlterTable
ALTER TABLE "landmarks" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "osm_id" TEXT NOT NULL,
ADD COLUMN     "osm_type" TEXT NOT NULL,
ADD COLUMN     "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "landmarks_osm_id_key" ON "landmarks"("osm_id");

-- CreateIndex
CREATE INDEX "landmarks_category_idx" ON "landmarks"("category");

-- CreateIndex
CREATE INDEX "nodes_lat_lng_idx" ON "nodes"("lat", "lng");

-- AddForeignKey
ALTER TABLE "landmarks" ADD CONSTRAINT "landmarks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
