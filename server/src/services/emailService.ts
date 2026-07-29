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
    private templateCache: Map<string, ReturnType<typeof handlebars.compile>> = new Map();

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
            // Strip CR/LF and cap length to guard against email header injection
            // via any user-influenced subject (e.g. contact-form subject lines).
            const safeSubject = (options.subject || '').replace(/[\r\n]+/g, ' ').slice(0, 250);
            await transporter.sendMail({
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                subject: safeSubject,
                html: options.html,
            });
            console.log(`✅ Email sent to: ${options.to}`);
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            throw error;
        }
    }

    /**
     * Locate a template's HTML source. Searches every place it can live across dev
     * (ts-node from src) and prod (compiled dist — with or without the template copy
     * step, and accounting for the `cp -r` nesting gotcha). This is what prevents the
     * raw-JSON fallback when a deploy ships dist without templates copied alongside it.
     */
    private loadTemplateSource(templateName: string): string {
        const candidates = [
            path.join(__dirname, '../templates/emails', `${templateName}.html`),           // dist/templates/emails OR src (ts-node)
            path.join(__dirname, '../../src/templates/emails', `${templateName}.html`),     // running from dist, source still deployed
            path.join(__dirname, '../templates/templates/emails', `${templateName}.html`),  // `cp -r src/templates dist/templates` nesting
            path.join(process.cwd(), 'dist/templates/emails', `${templateName}.html`),
            path.join(process.cwd(), 'src/templates/emails', `${templateName}.html`),
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf-8');
        }
        throw new Error(`Email template not found: ${templateName}`);
    }

    /**
     * Render template with data. Compiled templates are cached.
     */
    private renderTemplate(templateName: string, data: TemplateData): string {
        try {
            let compiled = this.templateCache.get(templateName);
            if (!compiled) {
                compiled = handlebars.compile(this.loadTemplateSource(templateName));
                this.templateCache.set(templateName, compiled);
            }
            return compiled(data);
        } catch (error) {
            console.error(`❌ Template rendering failed for ${templateName}:`, error);
            return this.renderFallbackEmail(data);
        }
    }

    /**
     * Last-resort body used only if a template genuinely can't be found or compiled.
     * Produces a clean, branded message and never leaks the raw data object to the recipient.
     */
    private renderFallbackEmail(data: TemplateData): string {
        const name = (data.username || data.name || data.fullName || data.mentorName || data.studentName || 'there') as string;
        const actionUrl = (data.dashboardUrl || data.loginLink || data.verificationLink || this.getClientBaseUrl()) as string;
        return `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#333333">
              <h2 style="color:#4f46e5;margin:0 0 16px">EmpowerEd Learnings</h2>
              <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Hi ${name},</p>
              <p style="font-size:16px;line-height:1.6;margin:0 0 16px">There's an update on your EmpowerEd Learnings account. Sign in to your dashboard to view the details.</p>
              <p style="margin:24px 0">
                <a href="${actionUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:16px;font-weight:bold">Go to your dashboard</a>
              </p>
              <p style="font-size:13px;color:#999999;margin:24px 0 0">— Team EmpowerEd Learnings</p>
            </div>`;
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
        reminderType?: '24h' | '4h';
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const isSoon = data.reminderType === '4h';
        const whenText = isSoon ? 'later today (in about 4 hours)' : 'tomorrow';
        const html = this.renderTemplate('student/session-reminder', {
            ...data,
            whenText,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.studentEmail,
            subject: isSoon
                ? 'Reminder – Your Session Starts in About 4 Hours'
                : '24-Hour Reminder – Don’t Miss Your Session',
            html,
        });
    }

    async sendSessionRescheduledStudent(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        previousDate?: string;
        previousTime?: string;
        sessionDate: string;
        sessionTime: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('student/session-rescheduled', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Your Session Has Been Rescheduled',
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
        reminderType?: '24h' | '4h';
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const isSoon = data.reminderType === '4h';
        const whenText = isSoon ? 'later today (in about 4 hours)' : 'tomorrow';
        const html = this.renderTemplate('mentor/session-reminder', {
            ...data,
            whenText,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: isSoon
                ? `Reminder: Session in About 4 Hours with ${data.studentName}`
                : `Reminder: Session Tomorrow with ${data.studentName}`,
            html,
        });
    }

    async sendSessionRescheduledMentor(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        previousDate?: string;
        previousTime?: string;
        sessionDate: string;
        sessionTime: string;
        meetingLink: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/session-rescheduled', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: `Session Rescheduled by ${data.studentName}`,
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

    async sendMentorProfileLive(data: {
        mentorName: string;
        mentorEmail: string;
        profileUrl?: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/profile-live', {
            ...data,
            profileUrl: data.profileUrl || `${baseUrl}/dashboard`,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Congratulations — Your EmpowerEd Mentor Profile Is Now Live!',
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
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('mentor/student-payment-received', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Payment Confirmed for Upcoming Session',
            html,
        });
    }

    async sendMentorSessionCancelledUnpaid(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        sessionDate: string;
        sessionTime: string;
        timezone?: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/session-cancelled-unpaid', {
            ...data,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Session Cancelled — Payment Not Received',
            html,
        });
    }

    async sendStudentSessionCancelledUnpaid(data: {
        studentName: string;
        studentEmail: string;
        mentorName: string;
        sessionDate: string;
        sessionTime: string;
        amount?: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('student/session-cancelled-unpaid', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/student/sessions`,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Your Session Has Been Cancelled — Payment Not Received',
            html,
        });
    }

    async sendStudentPaymentReceipt(data: {
        studentName: string;
        studentEmail: string;
        tutorName: string;
        sessionDate: string;
        sessionTime: string;
        amount: string;
        paymentDate: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const html = this.renderTemplate('student/payment-receipt', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/student/sessions`,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.studentEmail,
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
        role?: string;
        loginLink?: string;
        dashboardUrl?: string;
    }): Promise<void> {
        const baseUrl = this.getClientBaseUrl();
        const template = data.role === 'TUTOR' ? 'mentor/welcome' : 'student/welcome';
        const html = this.renderTemplate(template, {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/dashboard`,
            year: new Date().getFullYear(),
        });
        await this.sendEmail({
            to: data.email,
            subject: 'Welcome to EmpowerEd Learnings',
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

    async sendSubAdminWelcome(data: {
        email: string;
        username: string;
        password: string;
        permissionsList?: string;
    }): Promise<void> {
        // Admin portal lives on a separate domain; never use CLIENT_URL here.
        const adminBaseUrl = (process.env.ADMIN_DASHBOARD_URL || process.env.ADMIN_URL || 'https://admin.emplearnings.com').replace(/\/+$/, '');
        const html = this.renderTemplate('admin/sub-admin-welcome', {
            ...data,
            loginUrl: `${adminBaseUrl}/login`,
        });
        await this.sendEmail({
            to: data.email,
            subject: 'Your EmpowerEd Learnings Admin Account',
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
        referral_source?: string;
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
            ['How did you hear about us', data.referral_source || '—'],
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
        const firstName = data.full_name.split(' ')[0];
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
  <p style="margin:0 0 16px 0">Hi ${firstName},</p>
  <p style="margin:0 0 16px 0">Thanks for applying to join the EmpowerEd Learnings Founding Mentor Beta.</p>
  <p style="margin:0 0 16px 0">We are reviewing applications on a rolling basis and selecting a limited group of mentors for this early phase.</p>
  <p style="margin:0 0 16px 0">If selected, you will receive the next steps by email, including how to get started on the platform and what to expect during beta.</p>
  <p style="margin:0 0 16px 0">No credit card is required for beta access.</p>
  <p style="margin:0 0 32px 0">We appreciate your interest and look forward to learning more about your work.</p>
  <p style="margin:0">Team EmpowerEd Learnings</p>
</body>
</html>`;

        await this.sendEmail({
            to: data.email,
            subject: 'We received your beta application',
            html,
        });
    }

    async sendBetaApplicationAccepted(data: {
        full_name: string;
        email: string;
    }): Promise<void> {
        const firstName = data.full_name.split(' ')[0];
        const baseUrl = this.getClientBaseUrl();
        const createAccountUrl = `${baseUrl}/tutor-register`;
        const bookDemoUrl = `${baseUrl}/book-demo`;

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
  <p style="margin:0 0 16px 0">Hi ${firstName},</p>
  <p style="margin:0 0 16px 0">We're excited to let you know that your application to join the EmpowerEd Learnings Founding Mentor Beta has been approved.</p>
  <p style="margin:0 0 16px 0">You can now create your mentor account and complete your profile using the link below:</p>
  <p style="margin:0 0 24px 0">
    <a href="${createAccountUrl}" style="display:inline-block;background:#4A148C;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:600;font-size:15px">Create My Mentor Account</a>
  </p>
  <p style="margin:0 0 16px 0">Once your profile is complete, our team will review it and help you get ready to start using the platform.</p>
  <p style="margin:0 0 16px 0">If you would like assistance with onboarding or setting up your profile, you can <a href="${bookDemoUrl}" style="color:#4A148C">book a demo call</a> through our website or simply reply to this email. We'll be happy to guide you through the process.</p>
  <p style="margin:0 0 32px 0">We're excited to have you join the EmpowerEd Learnings community and look forward to seeing you on the platform.</p>
  <p style="margin:0">Team EmpowerEd Learnings</p>
</body>
</html>`;

        await this.sendEmail({
            to: data.email,
            subject: "You've been accepted into the EmpowerEd Learnings Founding Mentor Beta",
            html,
        });
    }
    async sendBetaEndingReminder(data: { tutorName: string; email: string }): Promise<void> {
        const firstName = data.tutorName.split(' ')[0];
        const baseUrl = this.getClientBaseUrl();
        const continueUrl = `${baseUrl}/pricing`;
        const bookAdminCallUrl = `${baseUrl}/book-demo`;

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
  <p style="margin:0 0 16px 0">Hi ${firstName},</p>
  <p style="margin:0 0 16px 0">Your 2-month beta access to EmpowerEd Learnings is ending tomorrow.</p>
  <p style="margin:0 0 16px 0">We hope you've had a chance to set up your profile, explore the platform, and see how it can support your tutoring or coaching business.</p>
  <p style="margin:0 0 16px 0">To continue using EmpowerEd Learnings without interruption, you can activate your subscription here:</p>
  <p style="margin:0 0 24px 0">
    <a href="${continueUrl}" style="display:inline-block;background:#4A148C;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:600;font-size:15px">Continue with My Plan</a>
  </p>
  <p style="margin:0 0 16px 0">You'll be able to confirm your plan and complete your subscription securely through Stripe.</p>
  <p style="margin:0 0 16px 0">Your profile, sessions, and setup will remain exactly as they are. No need to start over.</p>
  <p style="margin:0 0 16px 0">If you have any questions or need help before continuing, feel free to reply to this email or book a quick call.</p>
  <p style="margin:0 0 32px 0">
    <a href="${bookAdminCallUrl}" style="display:inline-block;background:#DD5D00;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:600;font-size:15px">Book an Admin Call</a>
  </p>
  <p style="margin:0 0 32px 0">We'd love to have you continue with us.</p>
  <p style="margin:0">Team EmpowerEd Learnings</p>
</body>
</html>`;

        await this.sendEmail({
            to: data.email,
            subject: 'Your beta access ends tomorrow',
            html,
        });
    }
}

export default new EmailService();
