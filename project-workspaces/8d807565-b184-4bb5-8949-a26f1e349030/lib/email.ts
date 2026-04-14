import nodemailer from 'nodemailer'
import { Order } from '@prisma/client'

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
})

interface OrderEmailData extends Order {
  items: Array<{
    id: string
    productId: string
    quantity: number
    price: number
    product: {
      name: string
      images: string[]
    }
  }>
  user: {
    name: string | null
    email: string
  }
}

export async function sendOrderConfirmationEmail(order: OrderEmailData) {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td>${item.product.name}</td>
      <td>${item.quantity}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>$${(Number(item.price) * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('')

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #333; text-align: center;">Order Confirmation</h1>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2>Thank you for your order, ${order.user.name || 'Customer'}!</h2>
            <p>Order ID: <strong>${order.id}</strong></p>
            <p>Order Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Product</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Quantity</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Price</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: right;">
              <p><strong>Subtotal: $${Number(order.subtotal).toFixed(2)}</strong></p>
              <p><strong>Shipping: $${Number(order.shipping).toFixed(2)}</strong></p>
              <p><strong>Tax: $${Number(order.tax).toFixed(2)}</strong></p>
              <p style="font-size: 18px;"><strong>Total: $${Number(order.total).toFixed(2)}</strong></p>
            </div>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Shipping Address</h3>
            <p>
              ${order.shippingName}<br>
              ${order.shippingAddress1}<br>
              ${order.shippingAddress2 ? order.shippingAddress2 + '<br>' : ''}
              ${order.shippingCity}, ${order.shippingState} ${order.shippingZip}<br>
              ${order.shippingCountry}
            </p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <p>We'll send you another email when your order ships.</p>
            <p>Thanks for shopping with us!</p>
          </div>
        </div>
      </body>
    </html>
  `

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: order.user.email,
    subject: `Order Confirmation - ${order.id}`,
    html,
  })
}

export async function sendOrderShippedEmail(order: OrderEmailData) {
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #333; text-align: center;">Your Order Has Shipped!</h1>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2>Good news, ${order.user.name || 'Customer'}!</h2>
            <p>Your order <strong>${order.id}</strong> has been shipped and is on its way to you.</p>
            
            <h3>Shipping Address</h3>
            <p>
              ${order.shippingName}<br>
              ${order.shippingAddress1}<br>
              ${order.shippingAddress2 ? order.shippingAddress2 + '<br>' : ''}
              ${order.shippingCity}, ${order.shippingState} ${order.shippingZip}<br>
              ${order.shippingCountry}
            </p>
            
            <p>Expected delivery: 3-5 business days</p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <p>Thanks for shopping with us!</p>
          </div>
        </div>
      </body>
    </html>
  `

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: order.user.email,
    subject: `Your Order Has Shipped - ${order.id}`,
    html,
  })
}