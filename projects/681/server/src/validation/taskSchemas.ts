import { z } from "zod";

export const taskIdSchema = z.string().uuid({ message: "Invalid task ID format" });

export const titleSchema = z
  .string({
    required_error: "Title is required",
    invalid_type_error: "Title must be a string",
  })
  .min(1, { message: "Title cannot be empty" })
  .max(255, { message: "Title must be at most 255 characters long" })
  .trim();

export const descriptionSchema = z
  .string({
    invalid_type_error: "Description must be a string",
  })
  .max(5000, { message: "Description must be at most 5000 characters long" })
  .trim()
  .optional()
  .nullable();

export const dueDateSchema = z
  .string({
    invalid_type_error: "Due date must be a string in ISO 8601 format",
  })
  .datetime({ message: "Due date must be a valid ISO 8601 datetime string" })
  .optional()
  .nullable();

export const isCompletedSchema = z.boolean({
  invalid_type_error: "isCompleted must be a boolean",
});

export const createTaskSchema = z.object({
  body: z.object({
    title: titleSchema,
    description: descriptionSchema,
    dueDate: dueDateSchema,
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: taskIdSchema,
  }),
  body: z
    .object({
      title: titleSchema.optional(),
      description: descriptionSchema,
      dueDate: dueDateSchema,
      isCompleted: isCompletedSchema.optional(),
    })
    .refine(
      (data) =>
        data.title !== undefined ||
        data.description !== undefined ||
        data.dueDate !== undefined ||
        data.isCompleted !== undefined,
      {
        message: "At least one field must be provided to update",
        path: ["body"],
      }
    ),
});

export const toggleCompleteSchema = z.object({
  params: z.object({
    id: taskIdSchema,
  }),
  body: z.object({
    isCompleted: isCompletedSchema,
  }),
});

export type TaskId = z.infer<typeof taskIdSchema>;
export type CreateTaskRequest = z.infer<typeof createTaskSchema>["body"];
export type UpdateTaskRequest = z.infer<typeof updateTaskSchema>["body"];
export type ToggleCompleteRequest = z.infer<typeof toggleCompleteSchema>["body"];