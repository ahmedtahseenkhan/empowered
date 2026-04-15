import transporter from '../config/email';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
}

interface TemplateData {
    [key: string]: any;
}

class EmailService {
    private fromEmail: string;
    private fromName: string;

    constructor() {
        // Always show brand address so recipients see "From: Empowered Learnings <info@emplearnings.com>".
        // SMTP login remains SMTP_USER/SMTP_PASSWORD (e.g. Gmail); Gmail "Send mail as" must have info@emplearnings.com verified.
        this.fromEmail = 'info@emplearnings.com';
        this.fromName = process.env.SMTP_FROM_NAME || 'Empowered Learnings';
    }

    private getClientBaseUrl(): string {
        // Use production site by default so emails never point to localhost.
        const raw = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim();
        return raw.replace(/\/+$/, '');
    }

    /**
     * Send a raw email
     */
    async sendEmail(options: EmailOptions): Promise<void> {
        try {
            await transporter.sendMail({
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                subject: options.subject,
                html: options.html,
            });
            console.log(`✅ Email sent to: ${options.to}`);
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            throw error;
        }
    }

    /**
     * Render template with data
     */
    private renderTemplate(templateName: string, data: TemplateData): string {
        try {
            const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
            const templateSource = fs.readFileSync(templatePath, 'utf-8');
            const template = handlebars.compile(templateSource);
            return template(data);
        } catch (error) {
            console.error(`❌ Template rendering failed for ${templateName}:`, error);
            // Fallback to plain text
            return `<p>${JSON.stringify(data)}</p>`;
        }
    }

    /**
     * STUDENT EMAILS
     */

    async sendBookingConfirmationTrial(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        sessionDate: string;
        sessionTime: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('student/booking-confirmation-trial', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.studentEmail,
            subject: `Your Free Trial with ${data.mentorName} is Confirmed`,
            html,
        });
    }

    async sendBookingConfirmationRegular(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        firstSessionDate: string;
        firstSessionTime: string;
        frequency: string;
        totalSessions: number;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('student/booking-confirmation-regular', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Booking Confirmed – Check Your Dashboard',
            html,
        });
    }

    async sendSessionReminderStudent(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        sessionDate: string;
        sessionTime: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('student/session-reminder', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.studentEmail,
            subject: '24-Hour Reminder – Don’t Miss Your Session',
            html,
        });
    }

    async sendPostSessionFeedback(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        reviewLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('student/post-session-feedback', data);
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Rate Your Experience',
            html,
        });
    }

    async sendPaymentDueReminder(data: {
        studentName: string;
        studentEmail: string;
        tutorName: string;
        amount: string;
        dueDate: string;
        paymentLink: string;
        sessionDate?: string;
        sessionTime?: string;
    }): Promise<void> {
        const html = this.renderTemplate('student/payment-due-reminder', { ...data, year: new Date().getFullYear() });
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Action Required: Confirm Your Upcoming Session',
            html,
        });
    }

    /**
     * MENTOR EMAILS
     */

    async sendNewTrialBookingMentor(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        sessionDate: string;
        sessionTime: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/new-trial-booking', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'New Free Trial Booked',
            html,
        });
    }

    async sendNewRegularBookingMentor(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        firstSessionDate: string;
        firstSessionTime: string;
        frequency: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/new-regular-booking', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Recurring Booking Added to Your Calendar',
            html,
        });
    }

    async sendSessionReminderMentor(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        sessionDate: string;
        sessionTime: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/session-reminder', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: `Reminder: Session Tomorrow with ${data.studentName}`,
            html,
        });
    }

    async sendReviewReceivedMentor(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        rating: number;
        review: string;
        reviewLink?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/review-received', {
            ...data,
            reviewLink: data.reviewLink || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'You Received a New Review',
            html,
        });
    }

    async sendDemoCallConfirmation(data: {
        mentorName: string;
        mentorEmail: string;
        callDate: string;
        callTime: string;
        meetingLink: string;
        addToCalendarUrl?: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/demo-call-confirmation', {
            ...data,
            addToCalendarUrl: data.addToCalendarUrl || data.meetingLink,
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Your EmpowerEd Demo Is Scheduled',
            html,
        });
    }

    async sendDemoCallReminder(data: {
        mentorName: string;
        mentorEmail: string;
        callDate: string;
        callTime: string;
        meetingLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/demo-call-reminder', {
            ...data,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Your Demo Is Tomorrow – Don\u2019t Miss It',
            html,
        });
    }

    async sendDemoCallMissed(data: {
        mentorName: string;
        mentorEmail: string;
        rescheduleLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/demo-call-missed', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'We Missed You',
            html,
        });
    }

    async sendPostDemoEncouragement(data: {
        mentorName: string;
        mentorEmail: string;
        plansLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/post-demo-encouragement', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Start Your Free Trial',
            html,
        });
    }

    async sendMentorFreeTrialActivated(data: {
        mentorName: string;
        mentorEmail: string;
        dashboardUrl: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/free-trial-activated', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Free Trial Started – Complete Your Setup',
            html,
        });
    }

    async sendMentorSubscriptionCanceled(data: {
        mentorName: string;
        mentorEmail: string;
        downgradeUrl: string;
        reactivateUrl: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/subscription-canceled', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Your Subscription Has Been Canceled',
            html,
        });
    }

    async sendMentorPaymentReceived(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        sessionDate: string;
        sessionTime: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/student-payment-received', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Payment Confirmed for Upcoming Session',
            html,
        });
    }

    async sendMentorPaymentFailed(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        sessionDate: string;
        sessionTime: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/student-payment-failed', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Payment Failed – Session Not Confirmed Yet',
            html,
        });
    }

    async sendStudentPaymentFailed(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        sessionDate: string;
        sessionTime: string;
        updatePaymentUrl: string;
    }): Promise<void> {
        const html = this.renderTemplate('student/payment-failed', data);
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Payment Attempt Failed – Action Required',
            html,
        });
    }

    /**
     * ADMIN EMAILS
     */

    async sendNewSupportTicketNotification(data: {
        adminEmail: string;
        submitterName: string;
        submitterEmail: string;
        subject: string;
        message: string;
        source: string;
    }): Promise<void> {
        const html = this.renderTemplate('admin/new-support-ticket', data);
        await this.sendEmail({
            to: data.adminEmail,
            subject: `[Queries] ${data.subject}`,
            html,
        });
    }

    async sendSupportTicketReply(data: {
        userName: string;
        userEmail: string;
        ticketSubject: string;
        replyMessage: string;
    }): Promise<void> {
        const html = this.renderTemplate('admin/support-ticket-reply', data);
        await this.sendEmail({
            to: data.userEmail,
            subject: `Re: ${data.ticketSubject}`,
            html,
        });
    }

    async sendCertificationRequestNotification(data: {
        adminEmail: string;
        mentorName: string;
        certificationName: string;
        issuer: string;
        approvalLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('admin/certification-request', data);
        await this.sendEmail({
            to: data.adminEmail,
            subject: `New Certification Request from ${data.mentorName}`,
            html,
        });
    }

    async sendReviewSubmissionNotification(data: {
        adminEmail: string;
        mentorName: string;
        reviewSource: string;
        approvalLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('admin/review-submission', data);
        await this.sendEmail({
            to: data.adminEmail,
            subject: `New External Review Submission from ${data.mentorName}`,
            html,
        });
    }
    /**
     * WELCOME EMAILS
     */

    async sendVerificationCodeEmail(data: {
        username: string;
        email: string;
        code: string;
    }): Promise<void> {
        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:480px;margin:0 auto">
              <h2 style="color:#1a1a1a">Verify your email</h2>
              <p>Hi ${data.username},</p>
              <p>Use the code below to verify your email address. It expires in <strong>30 minutes</strong>.</p>
              <div style="margin:24px 0;text-align:center">
                <span style="display:inline-block;font-size:36px;font-weight:bold;letter-spacing:10px;color:#4f46e5;background:#f0f0ff;padding:16px 24px;border-radius:8px">${data.code}</span>
              </div>
              <p style="color:#555">If you did not create an account, you can safely ignore this email.</p>
              <p style="color:#999;font-size:12px">— EmpowerEd Learnings</p>
            </div>
        `;
        await this.sendEmail({
            to: data.email,
            subject: 'Your EmpowerEd Learnings verification code',
            html,
        });
    }

    async sendVerificationEmail(data: {
        username: string;
        email: string;
        verificationLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('verify-email', { ...data, year: new Date().getFullYear() });
        await this.sendEmail({
            to: data.email,
            subject: 'Verify Your Email - EmpowerEd Learnings',
            html,
        });
    }

    async sendWelcomeEmail(data: {
        username: string;
        email: string;
        loginLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('welcome', { ...data, year: new Date().getFullYear() });
        await this.sendEmail({
            to: data.email,
            subject: 'Welcome to EmpowerEd Learnings!',
            html,
        });
    }

    /**
     * DEMO BOOKING EMAILS
     */

    async sendDemoBookingConfirmation(data: {
        fullName: string;
        email: string;
        callDate: string;
        callTime: string;
    }): Promise<void> {
        const html = this.renderTemplate('demo-booking-confirmation', { ...data, year: new Date().getFullYear() });
        await this.sendEmail({
            to: data.email,
            subject: "You're All Set – Demo Call Confirmed | EmpowerEd Learnings",
            html,
        });
    }

    async sendDemoBookingAdminNotification(data: {
        adminEmail: string;
        fullName: string;
        email: string;
        phone: string;
        categoryAlignment: string;
        experienceYears: string;
        incomeStatus: string;
        lookingFor: string;
        callDate: string;
        callTime: string;
        meetingLink?: string;
    }): Promise<void> {
        // Admin dashboard lives on a separate domain; never use CLIENT_URL here.
        const adminBaseUrl = (process.env.ADMIN_DASHBOARD_URL || process.env.ADMIN_URL || 'https://admin.emplearnings.com').replace(/\/+$/, '');
        const html = this.renderTemplate('demo-booking-admin', {
            ...data,
            adminDashboardUrl: adminBaseUrl,
            meetingLink: data.meetingLink || '',
        });
        await this.sendEmail({
            to: data.adminEmail,
            subject: 'New Demo Call Booked',
            html,
        });
    }

    async sendBetaApplicationNotification(data: {
        adminEmail: string;
        full_name: string;
        email: string;
        phone_number: string;
        service_description: string;
        category: string;
        session_management: string[];
        has_active_clients: boolean;
        biggest_challenge: string;
        profile_link: string | null;
    }): Promise<void> {
        const rows = [
            ['Name', data.full_name],
            ['Email', data.email],
            ['Phone', data.phone_number],
            ['Services offered', data.service_description],
            ['Category', data.category],
            ['Session management', data.session_management.join(', ')],
            ['Has active clients', data.has_active_clients ? 'Yes' : 'No'],
            ['Biggest challenge', data.biggest_challenge],
            ['Profile link', data.profile_link || '—'],
        ]
            .map(([label, value]) => `<tr><td style="padding:6px 12px;font-weight:600;background:#f3e5f5;white-space:nowrap">${label}</td><td style="padding:6px 12px">${value}</td></tr>`)
            .join('');

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Poppins,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#4A148C">New Beta Application</h2>
  <p>A new founding mentor beta application has been submitted.</p>
  <table style="border-collapse:collapse;width:100%">
    ${rows}
  </table>
  <p style="margin-top:24px;color:#666;font-size:13px">EmpowerEd Learnings — Beta Programme</p>
</body>
</html>`;

        await this.sendEmail({
            to: data.adminEmail,
            subject: `[Beta Application] ${data.full_name}`,
            html,
        });
    }

    async sendBetaApplicationConfirmation(data: {
        full_name: string;
        email: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Poppins,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#4A148C;margin-bottom:12px">Thanks for applying to the Empower<span style="color:#DD5D00">Ed</span> Beta</h2>
  <p style="margin:0 0 12px 0">Hi ${data.full_name},</p>
  <p style="margin:0 0 12px 0">We have received your founding mentor beta application successfully.</p>
  <p style="margin:0 0 12px 0">Our team will review your submission and contact you if you are selected for the next step.</p>
  <p style="margin:0 0 20px 0">If you have any urgent questions, reply to this email and our team will help you.</p>
  <a href="${baseUrl}" style="display:inline-block;background:#DD5D00;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9999px;font-weight:600">Visit EmpowerEd Learnings</a>
  <p style="margin-top:24px;color:#666;font-size:13px">EmpowerEd Learnings — Beta Programme</p>
</body>
</html>`;

        await this.sendEmail({
            to: data.email,
            subject: 'We Received Your Beta Application - EmpowerEd Learnings',
            html,
        });
    }
}

export default new EmailService();
