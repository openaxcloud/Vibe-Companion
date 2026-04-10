import { mobileAppService } from '../api/mobile-app-service';

export async function notifyDeployComplete(userId: number, projectName: string, url: string): Promise<void> {
  try {
    await mobileAppService.sendPushNotification({
      userId,
      title: 'Deploy Complete',
      body: `Your project "${projectName}" has been deployed successfully.`,
      type: 'deployment_complete',
      actionUrl: url,
      data: { projectName, url }
    });
  } catch (error) {
    console.error('[NotificationEvents] Failed to send deploy complete notification:', error);
  }
}

export async function notifyCollaborationInvite(userId: number, inviterName: string, projectName: string): Promise<void> {
  try {
    await mobileAppService.sendPushNotification({
      userId,
      title: 'Collaboration Invite',
      body: `${inviterName} invited you to collaborate on "${projectName}".`,
      type: 'collaboration_invite',
      data: { inviterName, projectName }
    });
  } catch (error) {
    console.error('[NotificationEvents] Failed to send collaboration invite notification:', error);
  }
}

export async function notifyPaymentFailed(userId: number, reason?: string): Promise<void> {
  try {
    await mobileAppService.sendPushNotification({
      userId,
      title: 'Payment Failed',
      body: reason || 'Your recent payment could not be processed. Please update your payment method.',
      type: 'payment_failed',
      data: { reason: reason || 'unknown' }
    });
  } catch (error) {
    console.error('[NotificationEvents] Failed to send payment failed notification:', error);
  }
}
