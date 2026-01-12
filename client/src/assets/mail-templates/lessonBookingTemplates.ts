export const generateLessonBookingEmailForStudent = (data: {
   studentName: string;
   tutorName: string;
   category: string;
   subCategory?: string;
   lessonType: string;
   schedule: Array<{
     date: string;
     time: string;
     dayOfWeek: string;
   }>;
   isRecurring: boolean;
   totalLessons?: number;
   studentTimezone?: string;
   studentUid?: string;
 }) => {
  const {
    studentName,
    tutorName,
    category,
    subCategory,
    lessonType,
    schedule,
    isRecurring,
    totalLessons,
    studentTimezone,
    studentUid,
  } = data;

  // Get timezone abbreviation
  const timezoneAbbr = studentTimezone
    ? studentTimezone.split("/").pop()?.replace("_", " ")
    : "Local";

  const scheduleHtml = schedule
    .map((slot) => {
      const timezoneDisplay = studentTimezone ? ` (${timezoneAbbr})` : "";

      // Convert the slot time to student's timezone for display
      let displayDate = slot.date;
      let displayTime = slot.time;

      if (studentTimezone) {
        try {
          // Parse the UTC date and time
          const slotDateTime = new Date(`${slot.date}T${slot.time}:00Z`);

          // Convert to student's timezone
          const studentDate = slotDateTime.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: studentTimezone,
          });

          const studentTime = slotDateTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: studentTimezone,
          });

          displayDate = studentDate;
          displayTime = studentTime;
        } catch (error) {
          console.error("Error converting time to student timezone:", error);
          // Fall back to original time if conversion fails
        }
      }

      return `
    <div style="background-color: #f8f9fa; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid #4a148c;">
      <strong>${slot.dayOfWeek}</strong> - ${displayDate} at <strong>${displayTime}${timezoneDisplay}</strong>
    </div>
  `;
    })
    .join("");

  return `
    <h1 style="color: #4a148c; margin-bottom: 20px;">✅ Your session with ${tutorName} is confirmed!</h1>
    
    <p>Hi <strong>${studentName}</strong>,</p>
    
    <p>Congratulations! You've successfully booked a ${
      lessonType === "25-min" ? "Free Trial" : "Regular"
    } session with ${tutorName}. 🎉</p>
    
    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #d4edda;">
      <h3 style="color: #155724; margin-top: 0;">� Date & Time</h3>
      ${scheduleHtml}
      
      <h3 style="color: #155724; margin-top: 15px;">�📚 Session Details</h3>
      <p><strong>Subject:</strong> ${category}${
    subCategory ? ` - ${subCategory}` : ""
  }</p>
      <p><strong>Session Type:</strong> ${
        lessonType === "25-min"
          ? "Free Trial (25 minutes)"
          : "Regular Session (50 minutes)"
      }</p>
      ${
        isRecurring
          ? `<p><strong>Frequency:</strong> ${totalLessons} sessions per month</p>`
          : ""
      }
    </div>

    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
      <h3 style="color: #856404; margin-top: 0;">📅 Schedule</h3>
      ${
        isRecurring
          ? "<p><strong>Weekly Recurring Schedule:</strong></p>"
          : "<p><strong>Lesson Time:</strong></p>"
      }
      ${scheduleHtml}
    </div>

    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeeba;">
      <h3 style="color: #856404; margin-top: 0;">� Tips for your first session:</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Find a quiet space with no distractions</li>
        <li>Test your audio/video before joining</li>
        <li>Bring any materials you'd like to review</li>
      </ul>
    </div>

    <div style="display: flex; gap: 20px; margin: 30px 0; justify-content: center;">
      <a href="https://emplearnings.com/student-dashboard/${studentUid}/student-mentors" style="display: inline-block; padding: 12px 24px; background-color: #4a148c; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-weight: bold; min-width: 140px;">Message Mentor</a>
      <a href="https://emplearnings.com/student-dashboard/${studentUid}" style="display: inline-block; padding: 12px 24px; background-color: #4a148c; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-weight: bold; min-width: 140px;">Visit Dashboard</a>
    </div>

    <p>We're excited for your learning journey!</p>

    <p>Best,<br/>
    <strong>Team EmpowerEd</strong></p>

    <img src="[LOGO_URL]" alt="EmpowerEd Logo" style="margin-top: 20px; max-width: 150px;"/>
  `;
};

export const generateLessonBookingEmailForTutor = (data: {
  studentName: string;
  tutorName: string;
  category: string;
  subCategory?: string;
  lessonType: string;
  schedule: Array<{
    date: string;
    time: string;
    dayOfWeek: string;
  }>;
  isRecurring: boolean;
  totalLessons?: number;
  studentEmail: string;
  tutorTimezone?: string;
}) => {
  const {
    studentName,
    tutorName,
    category,
    subCategory,
    lessonType,
    schedule,
    isRecurring,
    totalLessons,
    studentEmail,
    tutorTimezone,
  } = data;

  // Get timezone abbreviation
  const timezoneAbbr = tutorTimezone
    ? tutorTimezone.split("/").pop()?.replace("_", " ")
    : "Local";

  const scheduleHtml = schedule
    .map((slot) => {
      const timezoneDisplay = tutorTimezone ? ` (${timezoneAbbr})` : "";

      // Convert the slot time to tutor's timezone for display
      let displayDate = slot.date;
      let displayTime = slot.time;

      if (tutorTimezone) {
        try {
          // Parse the UTC date and time
          const slotDateTime = new Date(`${slot.date}T${slot.time}:00Z`);

          // Convert to tutor's timezone
          const tutorDate = slotDateTime.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: tutorTimezone,
          });

          const tutorTime = slotDateTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: tutorTimezone,
          });

          displayDate = tutorDate;
          displayTime = tutorTime;
        } catch (error) {
          console.error("Error converting time to tutor timezone:", error);
          // Fall back to original time if conversion fails
        }
      }

      return `
    <div style="background-color: #f8f9fa; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid #4a148c;">
      <strong>${slot.dayOfWeek}</strong> - ${displayDate} at <strong>${displayTime}${timezoneDisplay}</strong>
    </div>
  `;
    })
    .join("");

  return `
    <h1 style="color: #4a148c; margin-bottom: 20px;">New Sessions Scheduled with ${studentName}</h1>
    
    <p>Hello <strong>${tutorName}</strong>,</p>
    
    <p>New sessions have been scheduled with ${studentName}.</p>
    
    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #d4edda;">
      <h3 style="color: #155724; margin-top: 0;">� First Session</h3>
      ${scheduleHtml}
      
      <h3 style="color: #155724; margin-top: 15px;">📚 Session Details</h3>
      <p><strong>Subject:</strong> ${category}${
    subCategory ? ` - ${subCategory}` : ""
  }</p>
      <p><strong>Student:</strong> ${studentName} (${studentEmail})</p>
      <p><strong>Session Type:</strong> ${
        lessonType === "25-min"
          ? "Free Trial (25 minutes)"
          : "Regular Session (50 minutes)"
      }</p>
      ${
        isRecurring
          ? `<p><strong>Frequency:</strong> ${totalLessons} sessions per month</p>`
          : ""
      }
    </div>

    ${
      scheduleHtml.includes("Meeting Link")
        ? ""
        : `
    <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bee5eb;">
      <h3 style="color: #0c5460; margin-top: 0;">� Meeting Link</h3>
      <p>A meeting link will be generated and shared closer to the session time.</p>
    </div>
    `
    }

    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeeba;">
      <h3 style="color: #856404; margin-top: 0;">� Manage Sessions</h3>
      <p>You can view, manage, or reschedule these sessions anytime in your <a href="[DASHBOARD_URL]" style="color: #4a148c;">dashboard</a>.</p>
    </div>

    <p>Thank you for supporting students on EmpowerEd Learnings!</p>
    
    <p>Best regards,<br/>
    <strong>Team EmpowerEd</strong></p>

    <img src="[LOGO_URL]" alt="EmpowerEd Logo" style="margin-top: 20px; max-width: 150px;"/>
  `;
};
