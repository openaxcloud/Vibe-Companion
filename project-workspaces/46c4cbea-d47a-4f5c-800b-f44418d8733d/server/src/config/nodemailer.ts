import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOrderConfirmationEmail = async (to: string, orderId: string, totalAmount: number, items: any[]) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: `Order Confirmation - #${orderId}`,
    html: `
      <h1>Thank you for your order!</h1>
      <p>Your order #${orderId} has been placed successfully.</p>
      <p>Total Amount: $${totalAmount.toFixed(2)}</p>
      <h2>Order Details:</h2>
      <ul>
        ${items.map(item => `<li>${item.quantity} x ${item.name} ($${item.price.toFixed(2)} each)</li>`).join('')}
      </ul>
      <p>We will send you another email when your order has been shipped.</p>
      <p>Best regards,<br/>E-commerce Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent successfully.');
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

export default transporter;
