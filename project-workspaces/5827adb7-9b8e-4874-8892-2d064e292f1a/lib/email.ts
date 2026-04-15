import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
})

export const sendOrderConfirmationEmail = async (
  to: string,
  orderData: {
    orderId: string
    items: Array<{
      name: string
      quantity: number
      price: number
    }>
    total: number
    shippingAddress: string
  }
) => {
  const itemsList = orderData.items
    .map(item => `${item.name} x${item.quantity} - $${item.price.toFixed(2)}`)
    .join('\n')

  const emailContent = `
Order Confirmation - Order #${orderData.orderId}

Thank you for your order! Here are the details:

Items:
${itemsList}

Total: $${orderData.total.toFixed(2)}

Shipping Address:
${orderData.shippingAddress}

We'll send you another email when your order ships.

Thank you for shopping with us!
  `

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: `Order Confirmation - #${orderData.orderId}`,
      text: emailContent,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

export const sendOrderStatusEmail = async (
  to: string,
  orderId: string,
  status: string
) => {
  const emailContent = `
Order Update - Order #${orderId}

Your order status has been updated to: ${status}

Thank you for shopping with us!
  `

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: `Order Update - #${orderId}`,
      text: emailContent,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}