export const generateLessonRescheduleEmailForStudent = (data: {
  studentName: string;
  tutorName: string;
  oldDate: string;
  newDate: string;
  oldTime: string;
  newTime: string;
  studentUid?: string;
}) => {
  const {
    studentName,
    tutorName,
    oldDate,
    newDate,
    oldTime,
    newTime,
    studentUid,
  } = data;

  return `
    <h1 style="color: #4a148c; margin-bottom: 20px;">📅 Your session with  ${tutorName} has been rescheduled</h1>

    <p>Hi <strong>${studentName}</strong>,</p>

    <p>Your session with ${tutorName} has been successfully rescheduled. Here are the updated details:</p>

    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #d4edda;">
      <h3 style="color: #155724; margin-top: 0;">📅 Updated Lesson Details</h3>
      <p><strong>Mentor:</strong> ${tutorName}</p>
      <p><strong>Previous Date & Time:</strong> <span style="text-decoration: line-through; color: #6c757d;">${oldDate} at ${oldTime}</span></p>
      <p><strong>New Date & Time:</strong> <span style="color: #28a745; font-weight: bold;">${newDate} at ${newTime}</span></p>
    </div>

    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
      <h3 style="color: #856404; margin-top: 0;">⏰ Reminder</h3>
      <p>Please make sure you're available at the new time. If you need to make any further changes, you can do so through your dashboard.</p>
    </div>

    <div style="display: flex; gap: 20px; margin: 30px 0; justify-content: center;">
      <a href="https://emplearnings.com/student-dashboard/${studentUid}/student-mentors" style="display: inline-block; padding: 12px 24px; background-color: #4a148c; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-weight: bold; min-width: 140px;">Message Mentor</a>
      <a href="https://emplearnings.com/student-dashboard/${studentUid}" style="display: inline-block; padding: 12px 24px; background-color: #4a148c; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-weight: bold; min-width: 140px;">Visit Dashboard</a>
    </div>

    <p>If you have any questions, feel free to reach out to your mentor or our support team.</p>

    <p>Best,<br/>
    <strong>Team EmpowerEd</strong></p>

    <img src="[LOGO_URL]" alt="EmpowerEd Logo" style="margin-top: 20px; max-width: 150px;"/>
  `;
};

export const generateLessonRescheduleEmailForTutor = (data: {
  studentName: string;
  tutorName: string;
  oldDate: string;
  newDate: string;
  oldTime: string;
  newTime: string;
  studentEmail: string;
}) => {
  const {
    studentName,
    tutorName,
    oldDate,
    newDate,
    oldTime,
    newTime,
    studentEmail,
  } = data;

  return `
    <h1 style="color: #4a148c; margin-bottom: 20px;">📅 Session rescheduled with ${studentName}</h1>

    <p>Hello <strong>${tutorName}</strong>,</p>

    <p>Your session with ${studentName} has been rescheduled by the student. Here are the updated details:</p>

    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #d4edda;">
      <h3 style="color: #155724; margin-top: 0;">📅 Updated Lesson Details</h3>
      <p><strong>Student:</strong> ${studentName} (${studentEmail})</p>
      <p><strong>Previous Date & Time:</strong> <span style="text-decoration: line-through; color: #6c757d;">${oldDate} at ${oldTime}</span></p>
      <p><strong>New Date & Time:</strong> <span style="color: #28a745; font-weight: bold;">${newDate} at ${newTime}</span></p>
    </div>

    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
      <h3 style="color: #856404; margin-top: 0;">⏰ Important</h3>
      <p>Please take note of the new lesson time. You can view and manage all your lessons in your dashboard.</p>
    </div>

    <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bee5eb;">
      <h3 style="color: #0c5460; margin-top: 0;">📋 Manage Your Schedule</h3>
      <p>You can view, manage, or reschedule lessons anytime in your <a href="[DASHBOARD_URL]" style="color: #4a148c;">dashboard</a>.</p>
    </div>

    <p>Thank you for your flexibility and continued support of our students!</p>

    <p>Best regards,<br/>
    <strong>Team EmpowerEd</strong></p>

    <img src="[LOGO_URL]" alt="EmpowerEd Logo" style="margin-top: 20px; max-width: 150px;"/>
  `;
};