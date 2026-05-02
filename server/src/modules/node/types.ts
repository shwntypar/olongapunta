import { NodeType } from "../../../generated/prisma/client";

export interface CreateNodeDTO {
  name: string;
  description?: string;
  type: NodeType;
  lat: number;
  lng: number;
  landmarkAlias?: string;
}

export interface UpdateNodeDTO {
  name?: string;
  description?: string;
  type?: NodeType;
  lat?: number;
  lng?: number;
  landmarkAlias?: string;
}

export interface NodeResponse {
  id: string;
  name: string;
  description?: string;
  type: NodeType;
  lat: number;
  lng: number;
  landmarkAlias?: string;
  createdAt: Date;
  updatedAt: Date;
}
