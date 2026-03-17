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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const html = this.renderTemplate('mentor/new-trial-booking', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/tutor/dashboard`,
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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const html = this.renderTemplate('mentor/new-regular-booking', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/tutor/dashboard`,
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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const html = this.renderTemplate('mentor/session-reminder', {
            ...data,
            dashboardUrl: data.dashboardUrl || `${baseUrl}/tutor/dashboard`,
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
        const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const html = this.renderTemplate('mentor/review-received', {
            ...data,
            reviewLink: data.reviewLink || `${baseUrl}/tutor/dashboard`,
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
}

export default new EmailService();
