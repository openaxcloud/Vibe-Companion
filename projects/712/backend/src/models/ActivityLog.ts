import mongoose, { Document, Model, Schema } from "mongoose";

export type ActivityLogType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "COMMENT_UPDATED"
  | "COMMENT_DELETED"
  | "USER_ASSIGNED"
  | "USER_UNASSIGNED"
  | "BULK_UPDATE"
  | "SYSTEM_EVENT"
  | "OTHER";

export interface IActivityLog extends Document {
  projectId?: mongoose.Types.ObjectId | null;
  taskId?: mongoose.Types.ObjectId | null;
  userId?: mongoose.Types.ObjectId | null;
  type: ActivityLogType;
  message: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
      default: null,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      index: true,
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "PROJECT_CREATED",
        "PROJECT_UPDATED",
        "PROJECT_DELETED",
        "TASK_CREATED",
        "TASK_UPDATED",
        "TASK_DELETED",
        "TASK_STATUS_CHANGED",
        "COMMENT_ADDED",
        "COMMENT_UPDATED",
        "COMMENT_DELETED",
        "USER_ASSIGNED",
        "USER_UNASSIGNED",
        "BULK_UPDATE",
        "SYSTEM_EVENT",
        "OTHER",
      ],
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ projectId: 1, createdAt: -1 });
ActivityLogSchema.index({ taskId: 1, createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });

ActivityLogSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

ActivityLogSchema.set("toObject", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);

export default ActivityLog;