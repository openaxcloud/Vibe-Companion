import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  Association,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyHasAssociationMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
} from 'sequelize';
import { Inventory } from './Inventory';
import { Category } from './Category';

export interface ProductAttributes {
  id: number;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  thumbnailUrl: string | null;
  images: string[] | null;
  categoryId: number | null;
  active: boolean;
  brand: string | null;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCreationAttributes = Optional<
  ProductAttributes,
  'id' | 'description' | 'thumbnailUrl' | 'images' | 'categoryId' | 'active' | 'brand' | 'tags' | 'createdAt' | 'updatedAt'
>;

export class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  public id!: number;
  public title!: string;
  public description!: string | null;
  public price!: number;
  public currency!: string;
  public thumbnailUrl!: string | null;
  public images!: string[] | null;
  public categoryId!: number | null;
  public active!: boolean;
  public brand!: string | null;
  public tags!: string[] | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getInventories!: HasManyGetAssociationsMixin<Inventory>;
  public addInventory!: HasManyAddAssociationMixin<Inventory, number>;
  public hasInventory!: HasManyHasAssociationMixin<Inventory, number>;
  public countInventories!: HasManyCountAssociationsMixin;
  public createInventory!: HasManyCreateAssociationMixin<Inventory>;

  public getCategory!: BelongsToGetAssociationMixin<Category>;
  public setCategory!: BelongsToSetAssociationMixin<Category, number>;
  public createCategory!: BelongsToCreateAssociationMixin<Category>;

  public static associations: {
    inventories: Association<Product, Inventory>;
    category: Association<Product, Category>;
  };

  public static initialize(sequelize: Sequelize): typeof Product {
    Product.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            min: 0,
          },
        },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          defaultValue: 'USD',
        },
        thumbnailUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          validate: {
            isUrl: true,
          },
        },
        images: {
          type: DataTypes.JSONB,
          allowNull: true,
          validate: {
            isArrayOfStrings(value: unknown) {
              if (value == null) return;
              if (!Array.isArray(value)) {
                throw new Error('Images must be an array of strings');
              }
              for (const item of value) {
                if (typeof item !== 'string') {
                  throw new Error('Images must be an array of strings');
                }
              }
            },
          },
        },
        categoryId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'Categories',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        brand: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        tags: {
          type: DataTypes.JSONB,
          allowNull: true,
          validate: {
            isArrayOfStrings(value: unknown) {
              if (value == null) return;
              if (!Array.isArray(value)) {
                throw new Error('Tags must be an array of strings');
              }
              for (const item of value) {
                if (typeof item !== 'string') {
                  throw new Error('Tags must be an array of strings');
                }
              }
            },
          },
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'Products',
        modelName: 'Product',
        indexes: [
          {
            fields: ['title'],
          },
          {
            fields: ['brand'],
          },
          {
            fields: ['active'],
          },
          {
            using: 'gin',
            fields: ['tags'],
          },
        ],
      }
    );

    return Product;
  }

  public static associate(): void {
    Product.hasMany(Inventory, {
      as: 'inventories',
      foreignKey: 'productId',
      sourceKey: 'id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    Product.belongsTo(Category, {
      as: 'category',
      foreignKey: 'categoryId',
      targetKey: 'id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  }
}

export default Product;