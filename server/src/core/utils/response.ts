/**
 * Standardized API response utilities for consistent response formatting
 */
import type { Response } from "express";

/**
 * Standard success response structure
 */
type SuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

/**
 * Sends a standardized success response with optional message
 * @param res - Express response object
 * @param data - Response data payload
 * @param statusCode - HTTP status code (default: 200)
 * @param message - Optional success message
 */
export const sendResponse = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  message?: string,
) => {
  const response: SuccessResponse<T> = { success: true, data };
  if (message) response.message = message;
  res.status(statusCode).json(response);
};
