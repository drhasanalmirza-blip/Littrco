import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'LITTR.co <notifications@littr.co>';
const ADMIN_EMAIL = 'hello@littr.co';

export async function sendContactNotification(data: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Contact Form: ${data.name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message}</p>
      `,
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Thanks for reaching out to LITTR.co',
      html: `
        <h2>Thanks for contacting us!</h2>
        <p>Hi ${data.name},</p>
        <p>We received your message and will get back to you within 24-48 hours.</p>
        <p>— The LITTR Team</p>
        <hr>
        <p style="color: #666; font-size: 12px;">LITTR.co | Recycling vapes & batteries responsibly across upstate NY</p>
      `,
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
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Bin Request: ${data.businessName}`,
      html: `
        <h2>New Bin Request</h2>
        <p><strong>Business:</strong> ${data.businessName}</p>
        <p><strong>Contact:</strong> ${data.contactPerson}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Address:</strong> ${data.address}</p>
        <p><strong>Estimated Volume:</strong> ${data.volume}</p>
      `,
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Your LITTR Bin Request Received',
      html: `
        <h2>We got your bin request!</h2>
        <p>Hi ${data.contactPerson},</p>
        <p>Thanks for requesting a free LITTR recycling bin for <strong>${data.businessName}</strong>.</p>
        <p>We'll review your request and reach out within 48 hours to schedule delivery.</p>
        <p>Questions? Reply to this email or call us at (607) 385-0725.</p>
        <p>— The LITTR Team</p>
        <hr>
        <p style="color: #666; font-size: 12px;">LITTR.co | Recycling vapes & batteries responsibly across upstate NY</p>
      `,
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
      subject: `New Volunteer Application: ${data.name}`,
      html: `
        <h2>New Volunteer Application</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Interest:</strong> ${data.interest}</p>
        <p><strong>Availability:</strong> ${data.availability}</p>
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
      `,
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: 'Thanks for volunteering with LITTR!',
      html: `
        <h2>Thanks for your interest in volunteering!</h2>
        <p>Hi ${data.name},</p>
        <p>We appreciate you wanting to help make upstate NY cleaner and safer.</p>
        <p>We'll review your application and reach out soon with next steps.</p>
        <p>— The LITTR Team</p>
        <hr>
        <p style="color: #666; font-size: 12px;">LITTR.co | Recycling vapes & batteries responsibly across upstate NY</p>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export async function sendCustomEmail(to: string, subject: string, html: string) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log('Resend API response:', JSON.stringify(result, null, 2));
    return { success: true, result };
  } catch (error: any) {
    console.error('Email send error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message || error };
  }
}
