import type { Request, Response } from "express";
import { asyncHandler } from "../core/middleware/error-handler.middleware";
import { fetchOverpassAmenitiesJson } from "./overpassAmenitiesFetch";

/**
 * GET /api/amenities — proxies Overpass for OSM amenities in the bounding box.
 */
export const getAmenities = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const result = await fetchOverpassAmenitiesJson();

    if (!result.ok) {
      res.status(502).json({
        error: result.message,
        upstreamStatus: result.upstreamStatus,
        detail: result.detail,
      });
      return;
    }

    res.json(result.data);
  },
);
