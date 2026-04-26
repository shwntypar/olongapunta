import type { NextFunction, Response, Request } from "express";
import { config } from "../../config/environment";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    [key: string]: any; // Allow additional properties if needed
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token = req.headers.authorization?.replace("Bearer ", "").trim();

    if (!token) {
      token =
        req.signedCookies?.[config.cookie] ||
        req.cookies?.[config.cookie] ||
        req.signedCookies["OLONGAPUNTA_COOKIE"] ||
        req.cookies["OLONGAPUNTA_COOKIE"];
    }

    if (!token) {
      throw new Error("No authentication token provided");
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      userId: string;
      email: string;
      sub?: string;
      [key: string]: any;
    };

    const userId = decoded.userId || decoded.sub || decoded.id;

    if (!userId) {
      throw new Error("Invalid token: missing user ID");
    }

    req.user = {
      id: Number(userId),
      email: decoded.email,
    };

    next();
  } catch (error) {
    logger.error("Authentication error", { error });
    res.status(401).json({ message: "Unauthorized" });
  }
};
