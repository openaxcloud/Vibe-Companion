import Joi, { ObjectSchema } from 'joi';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'archived';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string | null;
  assigneeId?: string | null;
  labels?: string[];
  parentId?: string | null;
  position?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: 'todo' | 'in_progress' | 'done' | 'archived';
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  labels?: string[];
  parentId?: string | null;
  position?: number;
  metadata?: Record<string, unknown> | null;
}

export interface ReorderTasksPayload {
  orderedIds: string[];
  parentId?: string | null;
}

export interface BulkUpdateStatusPayload {
  taskIds: string[];
  status: 'todo' | 'in_progress' | 'done' | 'archived';
}

export interface BulkDeleteTasksPayload {
  taskIds: string[];
}

const idSchema = Joi.string()
  .trim()
  .guid({ version: ['uuidv4', 'uuidv5'] })
  .messages({
    'string.guid': 'ID must be a valid UUID',
    'string.empty': 'ID is required',
  });

const nullableIdSchema = idSchema.allow(null);

const isoDateString = Joi.string()
  .isoDate()
  .messages({
    'string.isoDate': 'Date must be a valid ISO 8601 date string',
  });

const titleSchema = Joi.string()
  .trim()
  .min(1)
  .max(255)
  .messages({
    'string.empty': 'Title is required',
    'string.min': 'Title must be at least {#limit} character long',
    'string.max': 'Title must be at most {#limit} characters long',
  });

const descriptionSchema = Joi.string()
  .allow('', null)
  .max(5000)
  .messages({
    'string.max': 'Description must be at most {#limit} characters long',
  });

const statusSchema = Joi.string()
  .valid('todo', 'in_progress', 'done', 'archived')
  .messages({
    'any.only': 'Status must be one of: todo, in_progress, done, archived',
  });

const prioritySchema = Joi.string()
  .valid('low', 'medium', 'high', 'urgent')
  .messages({
    'any.only': 'Priority must be one of: low, medium, high, urgent',
  });

const labelsSchema = Joi.array()
  .items(
    Joi.string()
      .trim()
      .min(1)
      .max(64)
  )
  .max(50)
  .unique()
  .messages({
    'array.max': 'Cannot have more than {#limit} labels',
    'array.unique': 'Labels must be unique',
  });

const metadataSchema = Joi.object().unknown(true);

export const createTaskSchema: ObjectSchema<CreateTaskPayload> = Joi.object<CreateTaskPayload>({
  title: titleSchema.required(),
  description: descriptionSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: isoDateString.allow(null).optional(),
  assigneeId: nullableIdSchema.optional(),
  labels: labelsSchema.optional(),
  parentId: nullableIdSchema.optional(),
  position: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Position must be a number',
      'number.integer': 'Position must be an integer',
      'number.min': 'Position cannot be negative',
    }),
  metadata: metadataSchema.optional(),
}).options({ abortEarly: false, stripUnknown: true });

export const updateTaskSchema: ObjectSchema<UpdateTaskPayload> = Joi.object<UpdateTaskPayload>({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.allow(null).optional(),
  dueDate: isoDateString.allow(null).optional(),
  assigneeId: nullableIdSchema.optional(),
  labels: labelsSchema.optional(),
  parentId: nullableIdSchema.optional(),
  position: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Position must be a number',
      'number.integer': 'Position must be an integer',
      'number.min': 'Position cannot be negative',
    }),
  metadata: metadataSchema.allow(null).optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update',
  })
  .options({ abortEarly: false, stripUnknown: true });

export const reorderTasksSchema: ObjectSchema<ReorderTasksPayload> = Joi.object<ReorderTasksPayload>({
  orderedIds: Joi.array()
    .items(idSchema)
    .min(1)
    .required()
    .messages({
      'array.base': 'orderedIds must be an array of IDs',
      'array.min': 'orderedIds must contain at least one ID',
    }),
  parentId: nullableIdSchema.optional(),
}).options({ abortEarly: false, stripUnknown: true });

export const bulkUpdateStatusSchema: ObjectSchema<BulkUpdateStatusPayload> = Joi.object<BulkUpdateStatusPayload>({
  taskIds: Joi.array()
    .items(idSchema)
    .min(1)
    .required()
    .messages({
      'array.base': 'taskIds must be an array of IDs',
      'array.min': 'taskIds must contain at least one ID',
    }),
  status: statusSchema.required(),
}).options({ abortEarly: false, stripUnknown: true });

export const bulkDeleteTasksSchema: ObjectSchema<BulkDeleteTasksPayload> = Joi.object<BulkDeleteTasksPayload>({
  taskIds: Joi.array()
    .items(idSchema)
    .min(1)
    .required()
    .messages({
      'array.base': 'taskIds must be an array of IDs',
      'array.min': 'taskIds must contain at least one ID',
    }),
}).options({ abortEarly: false, stripUnknown: true });

export const taskIdParamSchema = idSchema.required();

export const validateTaskIdList = Joi.array()
  .items(idSchema)
  .min(1)
  .messages({
    'array.base': 'Value must be an array of task IDs',
    'array.min': 'At least one task ID is required',
  })
  .options({ abortEarly: false, stripUnknown: true });

export type TaskSchemas = {
  createTaskSchema: ObjectSchema<CreateTaskPayload>;
  updateTaskSchema: ObjectSchema<UpdateTaskPayload>;
  reorderTasksSchema: ObjectSchema<ReorderTasksPayload>;
  bulkUpdateStatusSchema: ObjectSchema<BulkUpdateStatusPayload>;
  bulkDeleteTasksSchema: ObjectSchema<BulkDeleteTasksPayload>;
};