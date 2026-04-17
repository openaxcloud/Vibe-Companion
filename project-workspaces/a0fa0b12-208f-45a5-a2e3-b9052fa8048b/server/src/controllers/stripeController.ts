import { Request, Response } from 'express';
import stripe, { constructWebhookEvent, retrieveCheckoutSession } from '../services/stripeService';
import { updateOrder } from '../models/Order';
import { buffer } from 'micro'; // For parsing raw body
import { sendOrderConfirmationEmail } from '../services/emailService';
import { findUserById } from '../models/User';

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    const rawBody = await buffer(req); // Use micro's buffer to get raw body
    event = constructWebhookEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout Session Completed:', session.id);

      const orderId = session.metadata?.orderId as string;
      const userId = session.metadata?.userId as string;

      if (orderId) {
        try {
          await updateOrder(orderId, { paymentStatus: 'paid', orderStatus: 'processing', paymentIntentId: session.payment_intent as string });

          const user = await findUserById(userId);
          if (user) {
            // In a real app, you would fetch order details to populate the email
            const orderDetails = await retrieveCheckoutSession(session.id); // Or fetch from your DB
            const lineItems = orderDetails.line_items?.data.map(item => `<li>${item.quantity} x ${item.description} - $${(item.amount_total / 100).toFixed(2)}</li>`).join('');

            await sendOrderConfirmationEmail({
              to: user.email,
              subject: 'Your E-Market Order Confirmation',
              html: `
                <h1>Thank you for your order, ${user.username}!</h1>
                <p>Your order #${orderId.substring(0, 8)} has been successfully placed and is now being processed.</p>
                <h2>Order Summary</h2>
                <ul>
                  ${lineItems}
                </ul>
                <p>Total: $${(session.amount_total / 100).toFixed(2)}</p>
                <p>We will send you another email when your order has been shipped.</p>
                <p>Best regards,<br/>The E-Market Team</p>
              `,
            });
          }
        } catch (updateError) {
          console.error('Error updating order or sending email after checkout.session.completed:', updateError);
        }
      }
      break;
    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object;
      console.log('Payment Intent Failed:', paymentIntentFailed.id);
      // Handle payment failure, e.g., update order status to 'failed'
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
};


// Dummy endpoint for manually triggering success/fail if needed for testing frontend redirects
export const handleStripeSuccess = async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  if (!sessionId) return res.status(400).json({ message: 'Session ID required.' });
  try {
    const session = await retrieveCheckoutSession(sessionId);
    // For demo purposes, we can assume success based on session retrieval
    // In a real app, this should confirm payment status from the session object.
    res.status(200).json({ message: 'Payment successful!', session });
  } catch (error) {
    console.error('Error retrieving session on success page:', error);
    res.status(500).json({ message: 'Failed to verify payment.' });
  }
};
