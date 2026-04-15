import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export interface OrderEmailData {
  orderId: string
  customerName: string
  customerEmail: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  shippingAddress?: any
}

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  const itemsList = data.items
    .map(item => `${item.name} x${item.quantity} - $${item.price.toFixed(2)}`)
    .join('\n')

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: data.customerEmail,
    subject: `Order Confirmation - ${data.orderId}`,
    text: `
      Dear ${data.customerName},

      Thank you for your order! Here are the details:

      Order ID: ${data.orderId}
      
      Items:
      ${itemsList}
      
      Total: $${data.total.toFixed(2)}
      
      ${data.shippingAddress ? `Shipping Address:
      ${data.shippingAddress.line1}
      ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postal_code}` : ''}
      
      We'll send you another email when your order ships.
      
      Thank you for shopping with us!
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log('Order confirmation email sent successfully')
  } catch (error) {
    console.error('Error sending order confirmation email:', error)
  }
}

export async function sendLowStockAlert(productName: string, currentStock: number) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // Send to admin
    subject: `Low Stock Alert - ${productName}`,
    text: `
      Low stock alert for product: ${productName}
      
      Current stock level: ${currentStock}
      
      Please restock this item soon.
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log('Low stock alert sent successfully')
  } catch (error) {
    console.error('Error sending low stock alert:', error)
  }
}