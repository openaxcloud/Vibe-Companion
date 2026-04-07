import mongoose, { Document, Model, Schema } from "mongoose";

export interface IInventory extends Document {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryStaticMethods {
  adjustStock(
    productId: mongoose.Types.ObjectId | string,
    delta: number
  ): Promise<IInventory>;
  setStock(
    productId: mongoose.Types.ObjectId | string,
    quantity: number
  ): Promise<IInventory>;
  getStock(
    productId: mongoose.Types.ObjectId | string
  ): Promise<IInventory | null>;
  validateStockForCart(
    items: { productId: mongoose.Types.ObjectId | string; quantity: number }[]
  ): Promise<{ valid: boolean; errors: string[] }>;
}

export interface IInventoryModel extends Model<IInventory>, InventoryStaticMethods {}

const InventorySchema = new Schema<IInventory, IInventoryModel>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: [0, "Low stock threshold cannot be negative"],
      default: 5,
    },
    isLowStock: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

InventorySchema.pre("save", function (next) {
  this.isLowStock = this.quantity <= this.lowStockThreshold;
  next();
});

InventorySchema.statics.adjustStock = async function (
  productId: mongoose.Types.ObjectId | string,
  delta: number
): Promise<IInventory> {
  if (!delta || typeof delta !== "number") {
    throw new Error("Stock adjustment delta must be a non-zero number");
  }

  const updated = await this.findOneAndUpdate(
    { productId },
    {
      $inc: { quantity: delta },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  if (!updated) {
    throw new Error("Failed to adjust stock");
  }

  if (updated.quantity < 0) {
    updated.quantity = 0;
  }

  updated.isLowStock = updated.quantity <= updated.lowStockThreshold;
  await updated.save();

  return updated;
};

InventorySchema.statics.setStock = async function (
  productId: mongoose.Types.ObjectId | string,
  quantity: number
): Promise<IInventory> {
  if (typeof quantity !== "number" || quantity < 0) {
    throw new Error("Quantity must be a non-negative number");
  }

  const updated = await this.findOneAndUpdate(
    { productId },
    {
      $set: { quantity },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  if (!updated) {
    throw new Error("Failed to set stock");
  }

  updated.isLowStock = updated.quantity <= updated.lowStockThreshold;
  await updated.save();

  return updated;
};

InventorySchema.statics.getStock = async function (
  productId: mongoose.Types.ObjectId | string
): Promise<IInventory | null> {
  return this.findOne({ productId });
};

InventorySchema.statics.validateStockForCart = async function (
  items: { productId: mongoose.Types.ObjectId | string; quantity: number }[]
): Promise<{ valid: boolean; errors: string[] }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: true, errors: [] };
  }

  const productIds = items.map((item) => new mongoose.Types.ObjectId(item.productId));
  const inventoryDocs = await this.find({ productId: { $in: productIds } });

  const inventoryMap = new Map<string, IInventory>();
  inventoryDocs.forEach((doc) => {
    inventoryMap.set(doc.productId.toString(), doc);
  });

  const errors: string[] = [];

  for (const item of items) {
    const idStr = item.productId.toString();
    const neededQty = item.quantity;

    if (typeof neededQty !== "number" || neededQty <= 0) {
      errors.push(`Invalid quantity requested for product undefined`);
      continue;
    }

    const inventory = inventoryMap.get(idStr);

    if (!inventory) {
      errors.push(`No inventory record found for product undefined`);
      continue;
    }

    if (inventory.quantity < neededQty) {
      errors.push(
        `Insufficient stock for product undefined. Available: undefined, requested: undefined`
      );
    }
  }

  return { valid: errors.length === 0, errors };
};

const Inventory: IInventoryModel =
  (mongoose.models.Inventory as IInventoryModel) ||
  mongoose.model<IInventory, IInventoryModel>("Inventory", InventorySchema);

export default Inventory;