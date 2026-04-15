import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { Order } from '../../types';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_PORT === '465', // Use 'true' for 465, 'false' for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOrderConfirmationEmail = async (to: string, order: Order) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: `Order Confirmation #${order.id.substring(0, 8)} - E-Marketplace`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #1a202c; padding: 30px; border-radius: 8px; border: 1px solid #2d3748;">
          <h2 style="color: #6366f1; text-align: center; margin-bottom: 20px;">Thank You for Your Order!</h2>
          <p>Hi there,</p>
          <p>Your order <strong>#${order.id.substring(0, 8)}</strong> has been successfully placed and is now ${order.status}.</p>
          <p><strong>Order Details:</strong></p>
          <ul style="list-style: none; padding: 0;">
            ${order.items.map(item => `
              <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #2d3748;">
                <span style="font-weight: bold; color: #cbd5e0;">${item.name}</span> (x${item.quantity}) - $${item.price.toFixed(2)} each
                <br/>Total: $${(item.price * item.quantity).toFixed(2)}
              </li>
            `).join('')}
          </ul>
          <p style="font-size: 1.2em; font-weight: bold; color: #34d399;">Order Total: $${order.totalAmount.toFixed(2)}</p>
          <p>We'll send another email when your order has shipped.</p>
          <p>Thanks for shopping with E-Marketplace!</p>
          <p style="text-align: center; margin-top: 30px; font-size: 0.8em; color: #718096;">
            E-Marketplace Team
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent successfully to:', to);
  } catch (error) {
    console.error('Error sending order confirmation email to', to, ':', error);
  }
};
