import z from "zod";

export const NodesValidation = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required."),
    description: z.string().optional(),
    type: z.enum(
      [
        "LANDMARK",
        "INTERSECTION",
        "BUS_TERMINAL",
        "TODA_TERMINAL",
        "JEEPNEY_STOP",
      ],
      {
        message: "Invalid node type.",
      },
    ),
    lat: z
      .string()
      .regex(/^-?([1-8]?\d(\.\d+)?|90(\.0+)?)/, "Invalid latitude."),
    lng: z
      .string()
      .regex(/^-?((([1-9]?\d|1[0-7]\d|180)(\.\d+)?))$/, "Invalid longitude."),
    landmarkAlias: z.string().optional(),
  }),
});
