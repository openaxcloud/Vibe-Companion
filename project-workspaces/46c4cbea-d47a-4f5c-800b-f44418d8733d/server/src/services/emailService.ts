import { sendOrderConfirmationEmail } from '../config/nodemailer';
import { Order } from '../types';

export const sendConfirmationEmail = async (order: Order) => {
  await sendOrderConfirmationEmail(order.userEmail, order.id, order.totalAmount, order.items);
};
