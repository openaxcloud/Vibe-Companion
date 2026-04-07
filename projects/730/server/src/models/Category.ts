import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;
  parentId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryModel extends Model<ICategory> {
  findRootCategories(): Promise<ICategory[]>;
  findByParent(parentId: mongoose.Types.ObjectId | null): Promise<ICategory[]>;
}

const CategorySchema: Schema<ICategory> = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 255,
      unique: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ parentId: 1 });

CategorySchema.statics.findRootCategories = function (): Promise<ICategory[]> {
  return this.find({ parentId: null }).sort({ name: 1 }).exec();
};

CategorySchema.statics.findByParent = function (
  parentId: mongoose.Types.ObjectId | null
): Promise<ICategory[]> {
  return this.find({ parentId }).sort({ name: 1 }).exec();
};

export const Category: CategoryModel =
  (mongoose.models.Category as CategoryModel) ||
  mongoose.model<ICategory, CategoryModel>("Category", CategorySchema);

export default Category;