import type { Request, Response, NextFunction } from "express";

import { config } from "../../config/environment";
import { AppError, ValidationError } from "../utils/error";
import { logger } from "../utils/logger";

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    fields?: Record<string, string>;
    requestId?: string;
  };
  status: "error";
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID();

  logger.error("Error occurred", {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: (err as AppError).statusCode || 500,
  });

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        message: err.message,
        code: err.code,
        requestId,
      },
      status: "error",
    };

    if (err instanceof ValidationError && err.fields) {
      response.error.fields = err.fields;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  logger.error("Unexpected error", {
    requestId,
    error: err.message,
    stack: err.stack,
  });

  const isDevelopment = config.env === "development";

  res.status(500).json({
    error: {
      message: isDevelopment ? err.message : "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
      ...(isDevelopment && {
        stack: err.stack,
        details: err,
      }),
    },
    status: "error",
  });
};
