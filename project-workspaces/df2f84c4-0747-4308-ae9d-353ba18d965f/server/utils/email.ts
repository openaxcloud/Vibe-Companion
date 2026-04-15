import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOrderConfirmationEmail = async (email: string, orderId: string, totalAmount: number) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Order Confirmation - #${orderId}`,
    html: `
      <h1>Thank you for your order!</h1>
      <p>Your order #${orderId} has been confirmed.</p>
      <p>Total amount: $${totalAmount.toFixed(2)}</p>
      <p>We will notify you once your order has been shipped.</p>
      <p>Best regards,<br/>The E-commerce Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${email} for order ${orderId}`);
  } catch (error) {
    console.error(`Error sending email for order ${orderId}:`, error);
  }
};