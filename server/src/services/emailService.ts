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
        this.fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@empoweredlearnings.com';
        this.fromName = process.env.SMTP_FROM_NAME || 'EmpowerEd Learnings';
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
    }): Promise<void> {
        const html = this.renderTemplate('student/booking-confirmation-trial', data);
        await this.sendEmail({
            to: data.studentEmail,
            subject: `✅ Your Free Trial with ${data.mentorName} is confirmed!`,
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
    }): Promise<void> {
        const html = this.renderTemplate('student/booking-confirmation-regular', data);
        await this.sendEmail({
            to: data.studentEmail,
            subject: `✅ Your session with ${data.mentorName} is confirmed!`,
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
    }): Promise<void> {
        const html = this.renderTemplate('student/session-reminder', data);
        await this.sendEmail({
            to: data.studentEmail,
            subject: 'Get Ready for Your Session',
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
            subject: `⭐ How was your session with ${data.mentorName}?`,
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
    }): Promise<void> {
        const html = this.renderTemplate('student/payment-due-reminder', { ...data, year: new Date().getFullYear() });
        await this.sendEmail({
            to: data.studentEmail,
            subject: '💳 Payment Due Tomorrow - EmpowerEd',
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
    }): Promise<void> {
        const html = this.renderTemplate('mentor/new-trial-booking', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: `New Free Trial Session Scheduled with ${data.studentName}`,
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
    }): Promise<void> {
        const html = this.renderTemplate('mentor/new-regular-booking', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: `New Sessions Scheduled with ${data.studentName}`,
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
    }): Promise<void> {
        const html = this.renderTemplate('mentor/session-reminder', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: 'Upcoming Session Today',
            html,
        });
    }

    async sendReviewReceivedMentor(data: {
        mentorName: string;
        mentorEmail: string;
        studentName: string;
        rating: number;
        review: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/review-received', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: `You've received a new review from ${data.studentName}`,
            html,
        });
    }

    async sendDemoCallConfirmation(data: {
        mentorName: string;
        mentorEmail: string;
        callDate: string;
        callTime: string;
        meetingLink: string;
    }): Promise<void> {
        const html = this.renderTemplate('mentor/demo-call-confirmation', data);
        await this.sendEmail({
            to: data.mentorEmail,
            subject: "🎉 You're booked! Your EmpowerEd demo call is confirmed",
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
            subject: '❌ We missed you! Want to reschedule your demo?',
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
            subject: '🚀 Ready to launch your EmpowerEd journey?',
            html,
        });
    }

    /**
     * ADMIN EMAILS
     */

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
    }): Promise<void> {
        const html = this.renderTemplate('demo-booking-admin', data);
        await this.sendEmail({
            to: data.adminEmail,
            subject: `New Demo Booking: ${data.fullName} | EmpowerEd Learnings`,
            html,
        });
    }
}

export default new EmailService();
