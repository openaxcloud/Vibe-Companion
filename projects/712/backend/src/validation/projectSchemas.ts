import { z } from "zod";

const trimAndEmptyToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const PROJECT_NAME_MIN_LENGTH = 1;
const PROJECT_NAME_MAX_LENGTH = 100;
const PROJECT_KEY_MIN_LENGTH = 2;
const PROJECT_KEY_MAX_LENGTH = 15;

const projectNameSchema = z
  .string({
    required_error: "Project name is required",
    invalid_type_error: "Project name must be a string",
  })
  .transform((val) => val.trim())
  .min(PROJECT_NAME_MIN_LENGTH, {
    message: `Project name must be at least undefined character long`,
  })
  .max(PROJECT_NAME_MAX_LENGTH, {
    message: `Project name must be at most undefined characters long`,
  });

const projectKeySchema = z
  .string({
    required_error: "Project key is required",
    invalid_type_error: "Project key must be a string",
  })
  .transform((val) => val.trim().toUpperCase())
  .min(PROJECT_KEY_MIN_LENGTH, {
    message: `Project key must be at least undefined characters long`,
  })
  .max(PROJECT_KEY_MAX_LENGTH, {
    message: `Project key must be at most undefined characters long`,
  })
  .regex(/^[A-Z0-9_-]+$/, {
    message: "Project key may only contain letters, numbers, underscores, and hyphens",
  });

const optionalDescriptionSchema = z
  .string({
    invalid_type_error: "Description must be a string",
  })
  .transform(trimAndEmptyToUndefined)
  .optional()
  .nullable()
  .transform((val) => (val === null ? undefined : val));

const projectCreateSchema = z.object({
  name: projectNameSchema,
  key: projectKeySchema,
  description: optionalDescriptionSchema,
});

const projectUpdateSchema = z
  .object({
    name: z
      .string({
        invalid_type_error: "Project name must be a string",
      })
      .transform(trimAndEmptyToUndefined)
      .optional()
      .refine(
        (val) =>
          typeof val === "undefined" ||
          (typeof val === "string" &&
            val.length >= PROJECT_NAME_MIN_LENGTH &&
            val.length <= PROJECT_NAME_MAX_LENGTH),
        {
          message: `Project name must be between undefined and undefined characters`,
        }
      ),
    key: z
      .string({
        invalid_type_error: "Project key must be a string",
      })
      .transform((val) => val.trim().toUpperCase())
      .optional()
      .refine(
        (val) =>
          typeof val === "undefined" ||
          (typeof val === "string" &&
            val.length >= PROJECT_KEY_MIN_LENGTH &&
            val.length <= PROJECT_KEY_MAX_LENGTH &&
            /^[A-Z0-9_-]+$/.test(val)),
        {
          message:
            "Project key must be 2-15 characters and may only contain letters, numbers, underscores, and hyphens",
        }
      ),
    description: optionalDescriptionSchema,
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided to update",
      path: [],
    }
  );

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export {
  projectCreateSchema,
  projectUpdateSchema,
  projectNameSchema,
  projectKeySchema,
};