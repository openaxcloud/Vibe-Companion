// @ts-nocheck
/**
 * Billing Email Templates
 * Professional email templates for billing notifications
 */

import type { UserCredits, BudgetLimit } from '@shared/schema';

const APP_URL = process.env.APP_URL || process.env.REPLIT_DOMAINS?.split(',')[0] ? 
  `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}` : 'http://localhost:5000';

const FROM_NAME = process.env.FROM_NAME || 'E-Code Platform';

// Helper function to format currency
const formatCredits = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
};

// Helper function to calculate percentage
const calculateUsagePercentage = (used: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
};

// Base template styles
const baseStyles = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: white; padding: 30px; border: 1px solid #e5e5e5; border-radius: 0 0 10px 10px; }
    .alert-box { padding: 15px; border-radius: 8px; margin: 20px 0; }
    .alert-warning { background: #fff3cd; border: 1px solid #ffecb5; color: #856404; }
    .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
    .alert-info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
    .alert-success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
    .usage-meter { width: 100%; height: 30px; background: #f0f0f0; border-radius: 15px; overflow: hidden; margin: 20px 0; }
    .usage-fill { height: 100%; background: linear-gradient(90deg, #ff6b35, #f7931e); transition: width 0.3s; }
    .usage-fill.warning { background: linear-gradient(90deg, #ffc107, #ff9800); }
    .usage-fill.danger { background: linear-gradient(90deg, #dc3545, #c82333); }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }
    .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 15px 0; }
    .button:hover { background: linear-gradient(135deg, #f7931e 0%, #ff6b35 100%); }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f8f9fa; font-weight: 600; }
  </style>
`;

export const billingEmailTemplates = {
  // Budget threshold alert
  budgetThresholdAlert: (
    username: string,
    usagePercentage: number,
    remainingCredits: number,
    totalCredits: number,
    threshold: number
  ) => ({
    subject: `⚠️ Budget Alert: ${usagePercentage}% of credits used - E-Code Platform`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Budget Threshold Alert</h1>
            </div>
            <div class="content">
              <h2>Hi ${username},</h2>
              
              <div class="alert-box alert-warning">
                <strong>⚠️ Attention Required:</strong> You've used ${usagePercentage}% of your monthly credits, 
                which exceeds your alert threshold of ${threshold}%.
              </div>
              
              <p>Here's your current usage status:</p>
              
              <div class="usage-meter">
                <div class="usage-fill ${usagePercentage >= 90 ? 'danger' : usagePercentage >= 75 ? 'warning' : ''}" 
                     style="width: ${Math.min(usagePercentage, 100)}%"></div>
              </div>
              <p style="text-align: center; margin-top: -10px;">
                <strong>${usagePercentage}%</strong> used (${formatCredits(totalCredits - remainingCredits)} / ${formatCredits(totalCredits)} credits)
              </p>
              
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-value">${formatCredits(remainingCredits)}</div>
                  <div class="stat-label">Credits Remaining</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${formatCredits(totalCredits - remainingCredits)}</div>
                  <div class="stat-label">Credits Used</div>
                </div>
              </div>
              
              <h3>What you can do:</h3>
              <ul>
                <li>Review your current usage patterns in the dashboard</li>
                <li>Consider purchasing additional credits if needed</li>
                <li>Optimize resource usage to stay within budget</li>
                <li>Adjust your alert threshold in settings</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/usage" class="button">View Usage Dashboard</a>
                <a href="${APP_URL}/billing" class="button">Purchase Credits</a>
              </div>
              
              <div class="footer">
                <p>You're receiving this email because you've configured budget alerts at ${threshold}% usage.</p>
                <p>To modify your alert settings, visit <a href="${APP_URL}/settings/alerts">Alert Settings</a></p>
                <p>© ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Budget Threshold Alert - ${FROM_NAME}

Hi ${username},

You've used ${usagePercentage}% of your monthly credits, which exceeds your alert threshold of ${threshold}%.

Current Status:
- Credits Used: ${formatCredits(totalCredits - remainingCredits)} / ${formatCredits(totalCredits)}
- Credits Remaining: ${formatCredits(remainingCredits)}
- Usage: ${usagePercentage}%

What you can do:
- Review your current usage patterns in the dashboard
- Consider purchasing additional credits if needed
- Optimize resource usage to stay within budget
- Adjust your alert threshold in settings

View Usage Dashboard: ${APP_URL}/usage
Purchase Credits: ${APP_URL}/billing

You're receiving this email because you've configured budget alerts at ${threshold}% usage.
    `
  }),

  // Low credits warning
  lowCreditsWarning: (
    username: string,
    remainingCredits: number,
    totalCredits: number
  ) => ({
    subject: `⚠️ Low Credits Warning - Only ${formatCredits(remainingCredits)} credits remaining`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Low Credits Warning</h1>
            </div>
            <div class="content">
              <h2>Hi ${username},</h2>
              
              <div class="alert-box alert-warning">
                <strong>⚠️ Running Low:</strong> You have only <strong>${formatCredits(remainingCredits)} credits</strong> remaining.
              </div>
              
              <p>Your credits are running low and may soon affect your ability to use platform features.</p>
              
              <div class="usage-meter">
                <div class="usage-fill warning" style="width: ${Math.round((1 - remainingCredits / totalCredits) * 100)}%"></div>
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <div class="stat-box" style="display: inline-block; padding: 20px 40px;">
                  <div class="stat-value" style="color: #ff6b35;">${formatCredits(remainingCredits)}</div>
                  <div class="stat-label">Credits Remaining</div>
                </div>
              </div>
              
              <h3>Recommended Actions:</h3>
              <ul>
                <li><strong>Purchase additional credits</strong> to avoid service interruption</li>
                <li>Review recent usage to identify high-consumption activities</li>
                <li>Enable auto-recharge to automatically top up when low</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/billing" class="button">Purchase Credits Now</a>
              </div>
              
              <div class="alert-box alert-info">
                💡 <strong>Pro Tip:</strong> Enable auto-recharge to automatically add credits when your balance is low, 
                ensuring uninterrupted service.
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Low Credits Warning - ${FROM_NAME}

Hi ${username},

You have only ${formatCredits(remainingCredits)} credits remaining.

Your credits are running low and may soon affect your ability to use platform features.

Recommended Actions:
- Purchase additional credits to avoid service interruption
- Review recent usage to identify high-consumption activities  
- Enable auto-recharge to automatically top up when low

Purchase Credits Now: ${APP_URL}/billing

Pro Tip: Enable auto-recharge to automatically add credits when your balance is low.
    `
  }),

  // Credit depletion notification
  creditDepleted: (username: string) => ({
    subject: `🚨 Credits Depleted - Action Required`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Credits Depleted</h1>
            </div>
            <div class="content">
              <h2>Hi ${username},</h2>
              
              <div class="alert-box alert-danger">
                <strong>🚨 Urgent:</strong> Your credit balance has been depleted. 
                Some platform features may be restricted until you add more credits.
              </div>
              
              <p>Your account has run out of credits. To continue using premium features, please purchase additional credits.</p>
              
              <h3>Affected Services:</h3>
              <ul>
                <li>AI-powered code generation and assistance</li>
                <li>Advanced deployment options</li>
                <li>GPU computing resources</li>
                <li>Premium collaboration features</li>
                <li>High-performance database access</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${APP_URL}/billing" class="button" style="font-size: 18px; padding: 15px 30px;">
                  Purchase Credits Now
                </a>
              </div>
              
              <div class="alert-box alert-info">
                <strong>Note:</strong> Basic features remain available, but premium functionality requires credits.
              </div>
              
              <div class="footer">
                <p>Need help? Contact support at support@e-code.ai</p>
                <p>© ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Credits Depleted - ${FROM_NAME}

Hi ${username},

Your credit balance has been depleted. Some platform features may be restricted until you add more credits.

Affected Services:
- AI-powered code generation and assistance
- Advanced deployment options
- GPU computing resources
- Premium collaboration features
- High-performance database access

Purchase Credits Now: ${APP_URL}/billing

Note: Basic features remain available, but premium functionality requires credits.

Need help? Contact support at support@e-code.ai
    `
  }),

  // Overage alert
  overageAlert: (
    username: string,
    overageAmount: number,
    monthlyLimit: number
  ) => ({
    subject: `📊 Overage Alert - Usage exceeded monthly limit`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Usage Overage Alert</h1>
            </div>
            <div class="content">
              <h2>Hi ${username},</h2>
              
              <div class="alert-box alert-warning">
                <strong>📊 Overage Detected:</strong> Your usage has exceeded your monthly limit by 
                <strong>${formatCredits(overageAmount)} credits</strong>.
              </div>
              
              <p>You've exceeded your monthly credit limit of ${formatCredits(monthlyLimit)} credits.</p>
              
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-value">${formatCredits(monthlyLimit)}</div>
                  <div class="stat-label">Monthly Limit</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value" style="color: #dc3545;">${formatCredits(overageAmount)}</div>
                  <div class="stat-label">Overage Amount</div>
                </div>
              </div>
              
              <h3>What this means:</h3>
              <ul>
                <li>Additional usage will be billed at standard overage rates</li>
                <li>Consider upgrading your plan for better rates</li>
                <li>Review your usage patterns to optimize costs</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/billing/upgrade" class="button">Upgrade Plan</a>
                <a href="${APP_URL}/usage" class="button">View Usage Details</a>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Usage Overage Alert - ${FROM_NAME}

Hi ${username},

Your usage has exceeded your monthly limit by ${formatCredits(overageAmount)} credits.

Monthly Limit: ${formatCredits(monthlyLimit)} credits
Overage Amount: ${formatCredits(overageAmount)} credits

What this means:
- Additional usage will be billed at standard overage rates
- Consider upgrading your plan for better rates
- Review your usage patterns to optimize costs

Upgrade Plan: ${APP_URL}/billing/upgrade
View Usage Details: ${APP_URL}/usage
    `
  }),

  // Monthly usage summary
  monthlyUsageSummary: (
    username: string,
    month: string,
    totalUsed: number,
    totalCredits: number,
    topResources: Array<{ name: string; usage: number; cost: number }>
  ) => ({
    subject: `📈 Monthly Usage Summary - ${month}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📈 Monthly Usage Summary</h1>
            </div>
            <div class="content">
              <h2>Hi ${username},</h2>
              
              <p>Here's your usage summary for <strong>${month}</strong>:</p>
              
              <div class="alert-box alert-success">
                You used <strong>${formatCredits(totalUsed)} credits</strong> out of 
                <strong>${formatCredits(totalCredits)} credits</strong> available
                (${calculateUsagePercentage(totalUsed, totalCredits)}% utilization)
              </div>
              
              <div class="usage-meter">
                <div class="usage-fill" style="width: ${Math.min(calculateUsagePercentage(totalUsed, totalCredits), 100)}%"></div>
              </div>
              
              <h3>Top Resource Usage:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Usage</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  ${topResources.map(resource => `
                    <tr>
                      <td>${resource.name}</td>
                      <td>${resource.usage}</td>
                      <td>${formatCredits(resource.cost)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-value">${formatCredits(totalUsed)}</div>
                  <div class="stat-label">Total Credits Used</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${formatCredits(totalCredits - totalUsed)}</div>
                  <div class="stat-label">Credits Saved</div>
                </div>
              </div>
              
              <h3>💡 Optimization Tips:</h3>
              <ul>
                <li>Schedule resource-intensive tasks during off-peak hours</li>
                <li>Use auto-scaling to optimize compute costs</li>
                <li>Clean up unused resources regularly</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/usage/detailed" class="button">View Detailed Report</a>
              </div>
              
              <div class="footer">
                <p>This is your monthly usage summary. You can manage your email preferences in 
                   <a href="${APP_URL}/settings/notifications">notification settings</a>.</p>
                <p>© ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Monthly Usage Summary - ${FROM_NAME}

Hi ${username},

Here's your usage summary for ${month}:

You used ${formatCredits(totalUsed)} credits out of ${formatCredits(totalCredits)} credits available
(${calculateUsagePercentage(totalUsed, totalCredits)}% utilization)

Top Resource Usage:
${topResources.map(r => `- ${r.name}: ${r.usage} (${formatCredits(r.cost)} credits)`).join('\n')}

Total Credits Used: ${formatCredits(totalUsed)}
Credits Saved: ${formatCredits(totalCredits - totalUsed)}

Optimization Tips:
- Schedule resource-intensive tasks during off-peak hours
- Use auto-scaling to optimize compute costs  
- Clean up unused resources regularly

View Detailed Report: ${APP_URL}/usage/detailed

This is your monthly usage summary. Manage preferences at ${APP_URL}/settings/notifications
    `
  })
};

export default billingEmailTemplates;