import nodemailer from 'nodemailer';
import { OrderItem } from '../models/order.model';
import { findProductById } from '../models/product.model';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOrderConfirmationEmail = async (
  toEmail: string,
  orderId: string,
  items: { productId: string; quantity: number; price: number }[]
) => {
  try {
    const itemDetails = await Promise.all(
      items.map(async (item) => {
        const product = await findProductById(item.productId);
        return `<li>${product?.name || 'Unknown Product'} (x${item.quantity}) - $${item.price.toFixed(2)}</li>`;
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: toEmail,
      subject: `Order Confirmation #${orderId}`,
      html: `
        <h1>Thank you for your order!</h1>
        <p>Your order #${orderId} has been successfully placed and will be processed shortly.</p>
        <h2>Order Details:</h2>
        <ul>
          ${itemDetails.join('')}
        </ul>
        <p>We will send another email once your order has shipped.</p>
        <p>Best regards,<br>The E-Commerce Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${toEmail} for order ${orderId}`);
  } catch (error) {
    console.error(`Failed to send order confirmation email to ${toEmail} for order ${orderId}:`, error);
  }
};
