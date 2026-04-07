import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  Association,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
} from 'sequelize';
import { Order } from './Order';
import { Product } from './Product';

export interface OrderItemAttributes {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItemCreationAttributes
  extends Optional<OrderItemAttributes, 'id' | 'subtotal' | 'createdAt' | 'updatedAt'> {}

export class OrderItem
  extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes
{
  public id!: number;
  public orderId!: number;
  public productId!: number;
  public quantity!: number;
  public unitPrice!: number;
  public subtotal!: number;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  public getOrder!: BelongsToGetAssociationMixin<Order>;
  public setOrder!: BelongsToSetAssociationMixin<Order, number>;
  public createOrder!: BelongsToCreateAssociationMixin<Order>;

  public getProduct!: BelongsToGetAssociationMixin<Product>;
  public setProduct!: BelongsToSetAssociationMixin<Product, number>;
  public createProduct!: BelongsToCreateAssociationMixin<Product>;

  public static associations: {
    order: Association<OrderItem, Order>;
    product: Association<OrderItem, Product>;
  };

  public recalculateSubtotal(): void {
    this.subtotal = this.quantity * this.unitPrice;
  }

  public static initialize(sequelize: Sequelize): void {
    OrderItem.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        orderId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'Orders',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'Products',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        quantity: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          validate: {
            min: 1,
          },
        },
        unitPrice: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0,
          },
        },
        subtotal: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
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
        tableName: 'OrderItems',
        sequelize,
        hooks: {
          beforeValidate: (orderItem: OrderItem) => {
            if (orderItem.quantity == null || orderItem.unitPrice == null) return;
            orderItem.recalculateSubtotal();
          },
          beforeUpdate: (orderItem: OrderItem) => {
            if (orderItem.changed('quantity') || orderItem.changed('unitPrice')) {
              orderItem.recalculateSubtotal();
            }
          },
        },
      }
    );
  }

  public static associate(): void {
    OrderItem.belongsTo(Order, {
      as: 'order',
      foreignKey: 'orderId',
      targetKey: 'id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    OrderItem.belongsTo(Product, {
      as: 'product',
      foreignKey: 'productId',
      targetKey: 'id',
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  }
}

export default OrderItem;