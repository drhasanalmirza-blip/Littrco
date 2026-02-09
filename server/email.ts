import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'LITTR.co <notifications@littr.co>';
const ADMIN_EMAIL = 'hello@littr.co';

const emailWrapper = (content: string, isAdmin: boolean = false) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                LITTR<span style="color: #888888; font-weight: 400;">.co</span>
              </h1>
              ${isAdmin ? '<p style="margin: 8px 0 0 0; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Admin Notification</p>' : ''}
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #eee;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #888888; font-size: 13px; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;"><strong style="color: #000;">LITTR.co</strong></p>
                    <p style="margin: 0;">Recycling vapes & batteries responsibly</p>
                    <p style="margin: 0;">Buffalo • Rochester • Syracuse</p>
                  </td>
                  <td style="text-align: right; color: #888888; font-size: 13px;">
                    <p style="margin: 0;"><a href="tel:+16073850725" style="color: #000; text-decoration: none;">(607) 385-0725</a></p>
                    <p style="margin: 4px 0 0 0;"><a href="mailto:hello@littr.co" style="color: #000; text-decoration: none;">hello@littr.co</a></p>
                    <p style="margin: 4px 0 0 0;"><a href="https://littr.co" style="color: #000; text-decoration: none;">littr.co</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0 0; color: #aaa; font-size: 11px; text-align: center;">
          © ${new Date().getFullYear()} LITTR.co — All rights reserved
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const dataRow = (label: string, value: string) => `
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
      <span style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
      <p style="margin: 4px 0 0 0; color: #000; font-size: 16px;">${value}</p>
    </td>
  </tr>
`;

export async function sendContactNotification(data: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Contact: ${data.name}`,
      html: emailWrapper(`
        <h2 style="margin: 0 0 24px 0; color: #000; font-size: 24px; font-weight: 600;">New Contact Form</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Name', data.name)}
          ${dataRow('Email', `<a href="mailto:${data.email}" style="color: #000;">${data.email}</a>`)}
          ${dataRow('Message', data.message)}
        </table>
        <div style="margin-top: 32px;">
          <a href="mailto:${data.email}" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">Reply to ${data.name}</a>
        </div>
      `, true),
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Thanks for reaching out — LITTR.co',
      html: emailWrapper(`
        <h2 style="margin: 0 0 8px 0; color: #000; font-size: 24px; font-weight: 600;">We got your message!</h2>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">Thanks for reaching out, ${data.name}.</p>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
            We've received your message and will get back to you within <strong style="color: #000;">24-48 hours</strong>.
          </p>
        </div>
        
        <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6;">
          In the meantime, feel free to explore our <a href="https://littr.co/dropoff" style="color: #000; font-weight: 500;">drop-off locations</a> or learn more about our <a href="https://littr.co/business" style="color: #000; font-weight: 500;">business program</a>.
        </p>
        
        <p style="margin: 32px 0 0 0; color: #000; font-size: 15px;">
          — The LITTR Team
        </p>
      `),
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export async function sendBinRequestNotification(data: {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  volume: string;
}) {
  const volumeLabels: Record<string, string> = {
    'low': 'Low (1-50 units/month)',
    'medium': 'Medium (50-200 units/month)',
    'high': 'High (200+ units/month)',
  };

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Bin Request: ${data.businessName}`,
      html: emailWrapper(`
        <h2 style="margin: 0 0 24px 0; color: #000; font-size: 24px; font-weight: 600;">New Bin Request</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Business', data.businessName)}
          ${dataRow('Contact', data.contactPerson)}
          ${dataRow('Email', `<a href="mailto:${data.email}" style="color: #000;">${data.email}</a>`)}
          ${dataRow('Phone', `<a href="tel:${data.phone}" style="color: #000;">${data.phone}</a>`)}
          ${dataRow('Address', data.address)}
          ${dataRow('Volume', volumeLabels[data.volume] || data.volume)}
        </table>
        <div style="margin-top: 32px;">
          <a href="mailto:${data.email}?subject=Your%20LITTR%20Bin%20Request" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">Contact Business</a>
          <a href="tel:${data.phone}" style="display: inline-block; background-color: #fff; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px; border: 2px solid #000; margin-left: 8px;">Call Now</a>
        </div>
      `, true),
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Your LITTR Bin Request — Confirmed',
      html: emailWrapper(`
        <h2 style="margin: 0 0 8px 0; color: #000; font-size: 24px; font-weight: 600;">Request received!</h2>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">Thanks for requesting a free recycling bin for <strong style="color: #000;">${data.businessName}</strong>.</p>
        
        <div style="background-color: #000; border-radius: 12px; padding: 28px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">What's Next</p>
          <p style="margin: 0; color: #fff; font-size: 18px; font-weight: 500;">We'll reach out within 48 hours</p>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 16px 0; color: #000; font-weight: 600;">Your request summary:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #666;">
            <tr><td style="padding: 4px 0;">Business:</td><td style="padding: 4px 0; color: #000; text-align: right;">${data.businessName}</td></tr>
            <tr><td style="padding: 4px 0;">Location:</td><td style="padding: 4px 0; color: #000; text-align: right;">${data.address}</td></tr>
            <tr><td style="padding: 4px 0;">Est. Volume:</td><td style="padding: 4px 0; color: #000; text-align: right;">${volumeLabels[data.volume] || data.volume}</td></tr>
          </table>
        </div>
        
        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Questions in the meantime?</p>
        <p style="margin: 0; color: #000; font-size: 15px;">
          Reply to this email or call <a href="tel:+16073850725" style="color: #000; font-weight: 500;">(607) 385-0725</a>
        </p>
        
        <p style="margin: 32px 0 0 0; color: #000; font-size: 15px;">
          — The LITTR Team
        </p>
      `),
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export async function sendVolunteerNotification(data: {
  name: string;
  email: string;
  interest: string;
  availability: string;
  notes?: string;
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Volunteer: ${data.name}`,
      html: emailWrapper(`
        <h2 style="margin: 0 0 24px 0; color: #000; font-size: 24px; font-weight: 600;">New Volunteer Application</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Name', data.name)}
          ${dataRow('Email', `<a href="mailto:${data.email}" style="color: #000;">${data.email}</a>`)}
          ${dataRow('Interest', data.interest)}
          ${dataRow('Availability', data.availability)}
          ${data.notes ? dataRow('Notes', data.notes) : ''}
        </table>
        <div style="margin-top: 32px;">
          <a href="mailto:${data.email}?subject=Volunteering%20with%20LITTR" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">Contact ${data.name}</a>
        </div>
      `, true),
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Thanks for volunteering — LITTR.co',
      html: emailWrapper(`
        <h2 style="margin: 0 0 8px 0; color: #000; font-size: 24px; font-weight: 600;">You're amazing!</h2>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">Thanks for wanting to help, ${data.name}.</p>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
            We've received your volunteer application and will be in touch soon with opportunities that match your interests and availability.
          </p>
        </div>
        
        <div style="background-color: #000; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0; color: #fff; font-size: 16px; line-height: 1.6; text-align: center;">
            Together, we're making upstate NY cleaner and safer.
          </p>
        </div>
        
        <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6;">
          In the meantime, spread the word! Tell your friends about <a href="https://littr.co/dropoff" style="color: #000; font-weight: 500;">our drop-off locations</a>.
        </p>
        
        <p style="margin: 32px 0 0 0; color: #000; font-size: 15px;">
          — The LITTR Team
        </p>
      `),
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export async function sendCustomEmail(to: string, subject: string, html: string, fromAddress?: string) {
  try {
    const result = await resend.emails.send({
      from: fromAddress ? `${fromAddress.split('@')[0]} <${FROM_EMAIL}>` : FROM_EMAIL,
      replyTo: fromAddress || undefined,
      to,
      subject,
      html: emailWrapper(html),
    });
    console.log('Resend API response:', JSON.stringify(result, null, 2));
    return { success: true, result };
  } catch (error: any) {
    console.error('Email send error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message || error };
  }
}

export async function sendPointsClaimedEmail(email: string, points: number) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You earned ${points} points! — LITTR.co`,
      html: emailWrapper(`
        <div style="text-align: center; padding: 20px 0;">
          <div style="background-color: #000; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 36px;">🎉</span>
          </div>
          <h2 style="margin: 0 0 8px 0; color: #000; font-size: 28px; font-weight: 600;">+${points} Points!</h2>
          <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">Thanks for recycling responsibly!</p>
          
          <div style="background-color: #f9f9f9; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left;">
            <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
              Your points have been added to your wallet. Keep recycling to earn more and unlock awesome rewards!
            </p>
          </div>
          
          <a href="https://littr.co/app" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">View My Wallet</a>
        </div>
      `),
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export async function sendRedemptionEmail(email: string, itemName: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Redemption confirmed: ${itemName} — LITTR.co`,
      html: emailWrapper(`
        <div style="text-align: center; padding: 20px 0;">
          <div style="background-color: #000; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 36px;">🎁</span>
          </div>
          <h2 style="margin: 0 0 8px 0; color: #000; font-size: 28px; font-weight: 600;">Redemption Confirmed!</h2>
          <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">You've redeemed: <strong style="color: #000;">${itemName}</strong></p>
          
          <div style="background-color: #f9f9f9; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left;">
            <p style="margin: 0 0 12px 0; color: #000; font-weight: 600;">Delivery Info</p>
            <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
              We're on it! Your reward will be delivered to your email within 24-48 hours.
            </p>
          </div>
          
          <p style="margin: 0; color: #666; font-size: 14px;">
            Questions? Reply to this email or call <a href="tel:+16073850725" style="color: #000;">(607) 385-0725</a>
          </p>
        </div>
      `),
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Redemption: ${itemName}`,
      html: emailWrapper(`
        <h2 style="margin: 0 0 24px 0; color: #000; font-size: 24px; font-weight: 600;">New Redemption Request</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Customer Email', email)}
          ${dataRow('Item', itemName)}
          ${dataRow('Status', 'Pending Fulfillment')}
        </table>
        <div style="margin-top: 32px;">
          <a href="https://littr.co/staff/dashboard" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">View in Dashboard</a>
        </div>
      `, true),
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export async function sendShopVerificationEmail(email: string, shopName: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${shopName} is now verified! — LITTR.co`,
      html: emailWrapper(`
        <div style="text-align: center; padding: 20px 0;">
          <div style="background-color: #000; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 36px;">✅</span>
          </div>
          <h2 style="margin: 0 0 8px 0; color: #000; font-size: 28px; font-weight: 600;">You're Verified!</h2>
          <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;"><strong style="color: #000;">${shopName}</strong> is now an official LITTR partner.</p>
          
          <div style="background-color: #f9f9f9; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: left;">
            <p style="margin: 0 0 12px 0; color: #000; font-weight: 600;">What's next?</p>
            <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
              <li>Your LITTR bin will be delivered within 5 business days</li>
              <li>Access your partner dashboard to track activity</li>
              <li>Customers can now earn rewards at your location</li>
            </ul>
          </div>
          
          <a href="https://littr.co/partner/login" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">Partner Dashboard</a>
        </div>
      `),
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}
