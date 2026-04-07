import mongoose, { Document, Model, Schema } from "mongoose";

export interface ITimeEntry extends Document {
  taskId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  hours: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntryAggregationResult {
  _id: {
    taskId?: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    date?: Date;
  };
  totalHours: number;
  count: number;
}

interface TimeEntryModel extends Model<ITimeEntry> {
  aggregateByTask(taskId: string | mongoose.Types.ObjectId): Promise<TimeEntryAggregationResult[]>;
  aggregateByUser(userId: string | mongoose.Types.ObjectId): Promise<TimeEntryAggregationResult[]>;
  aggregateByTaskAndUser(
    taskId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<TimeEntryAggregationResult[]>;
  aggregateDailyForUser(
    userId: string | mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<TimeEntryAggregationResult[]>;
}

const TimeEntrySchema = new Schema<ITimeEntry, TimeEntryModel>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
      validate: {
        validator(value: Date): boolean {
          return !isNaN(value.getTime());
        },
        message: "Invalid date value",
      },
    },
    hours: {
      type: Number,
      required: true,
      min: [0, "Hours must be greater than or equal to 0"],
      max: [24, "Hours cannot exceed 24 in a single entry"],
      validate: {
        validator(value: number): boolean {
          return Number.isFinite(value);
        },
        message: "Hours must be a valid number",
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

TimeEntrySchema.index({ taskId: 1, userId: 1, date: 1 });
TimeEntrySchema.index({ userId: 1, date: 1 });
TimeEntrySchema.index({ taskId: 1, date: 1 });

TimeEntrySchema.statics.aggregateByTask = function (
  taskId: string | mongoose.Types.ObjectId
): Promise<TimeEntryAggregationResult[]> {
  const id = typeof taskId === "string" ? new mongoose.Types.ObjectId(taskId) : taskId;
  return this.aggregate([
    { $match: { taskId: id } },
    {
      $group: {
        _id: { taskId: "$taskId", userId: "$userId" },
        totalHours: { $sum: "$hours" },
        count: { $sum: 1 },
      },
    },
  ]).exec();
};

TimeEntrySchema.statics.aggregateByUser = function (
  userId: string | mongoose.Types.ObjectId
): Promise<TimeEntryAggregationResult[]> {
  const id = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  return this.aggregate([
    { $match: { userId: id } },
    {
      $group: {
        _id: { userId: "$userId", taskId: "$taskId" },
        totalHours: { $sum: "$hours" },
        count: { $sum: 1 },
      },
    },
  ]).exec();
};

TimeEntrySchema.statics.aggregateByTaskAndUser = function (
  taskId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId
): Promise<TimeEntryAggregationResult[]> {
  const tId = typeof taskId === "string" ? new mongoose.Types.ObjectId(taskId) : taskId;
  const uId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  return this.aggregate([
    { $match: { taskId: tId, userId: uId } },
    {
      $group: {
        _id: { taskId: "$taskId", userId: "$userId" },
        totalHours: { $sum: "$hours" },
        count: { $sum: 1 },
      },
    },
  ]).exec();
};

TimeEntrySchema.statics.aggregateDailyForUser = function (
  userId: string | mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<TimeEntryAggregationResult[]> {
  const uId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return Promise.reject(new Error("Invalid startDate or endDate"));
  }

  return this.aggregate([
    {
      $match: {
        userId: uId,
        date: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: {
          userId: "$userId",
          date: {
            $dateTrunc: {
              date: "$date",
              unit: "day",
            },
          },
        },
        totalHours: { $sum: "$hours" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.date": 1,
      },
    },
  ]).exec();
};

export const TimeEntry: TimeEntryModel =
  (mongoose.models.TimeEntry as TimeEntryModel) ||
  mongoose.model<ITimeEntry, TimeEntryModel>("TimeEntry", TimeEntrySchema);

export default TimeEntry;