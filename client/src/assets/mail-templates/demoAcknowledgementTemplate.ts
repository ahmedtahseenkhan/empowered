export const demoAcknowledgementTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Demo Request Acknowledgement</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #444;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        padding: 20px;
        text-align: center;
        background-color: #4a148c;
        color: white;
        border-radius: 5px 5px 0 0;
      }
      .content {
        background-color: #fff;
        padding: 30px;
        border: 1px solid #e0e0e0;
        border-top: none;
        border-radius: 0 0 5px 5px;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #888;
      }
      .button {
        display: inline-block;
        background-color: #9370db;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
        margin-top: 20px;
      }
      h1 {
        color: #4a148c;
        margin-top: 0;
      }
      .logo {
        max-width: 150px;
        margin-bottom: 10px;
      }
      .steps {
        margin: 20px 0;
        padding-left: 20px;
      }
      .highlight {
        font-weight: bold;
        color: #4a148c;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img
          class="logo"
          src="https://firebasestorage.googleapis.com/v0/b/empowered-89ae1.appspot.com/o/Publically_Accessible_empLogo%2Femplogos-09%201%20(2).png?alt=media&token=2f6fadc2-e8f7-4893-b130-918070efa4f6"
          alt="EmpowerEd Learnings Logo"
        />
        <h2>EmpowerEd Learnings</h2>
      </div>
      <div class="content">
        <h1>Thank You for Your Demo Request!</h1>
        <p>Hello,</p>
        <p>
          We're <span class="highlight">excited</span> that you're interested in
          becoming a tutor on our platform. Your demo request has been
          successfully received.
        </p>

        <p>Here's what happens next:</p>
        <ol class="steps">
          <li>Your demo session has been successfully scheduled.</li>
          <li>
            In the session, you'll learn more about our platform and how it
            works.
          </li>
          <li>
            We'll walk you through key features and answer any questions you may
            have.
          </li>
          <li>After the session, you'll receive details on the next steps.</li>
        </ol>

        <p>
          If you have any questions in the meantime, please don't hesitate to
          reach out to our support team.
        </p>

        <center>
          <a
            href="https://www.emplearnings.com/work-with-us"
            class="button"
            >Tutor FAQ</a
          >
        </center>

        <p>We look forward to seeing your teaching skills in action!</p>

        <p>
          Best regards,<br />
          <span class="highlight">The EmpowerEd Learnings Team</span>
        </p>
      </div>
      <div class="footer">
        <p>© 2025 EmpowerEd Learnings. All rights reserved.</p>
        <p>
          This email was sent to you because you requested a demo on our
          platform.
        </p>
      </div>
    </div>
  </body>
</html>
`;
