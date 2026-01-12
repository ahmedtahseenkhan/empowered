export const generateMailHTML = (customContentHtml: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EmpowerEd Learnings</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #444;
      margin: 0;
      padding: 0;
      background-color: #ffffff;
    }
    h1, h2 {
      color: #4a148c;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background-color: #9370db;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      margin-top: 20px;
    }
    .content {
      background-color: #ffffff;
      padding: 30px;
      border: 1px solid #e0e0e0;
      text-align: left;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 12px;
      color: #888888;
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="padding: 20px; background-color:#ffffff;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 20px 0 10px 0;">
              <img
                src="https://firebasestorage.googleapis.com/v0/b/empowered-89ae1.appspot.com/o/Publically_Accessible_empLogo%2Femplogos-09%201%20(2).png?alt=media&token=2f6fadc2-e8f7-4893-b130-918070efa4f6"
                alt="EmpowerEd Learnings Logo"
                style="width: 150px; height: auto; display: block; margin: 0 auto;"
              />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <h2 style="color: #4a148c; margin: 0;">EmpowerEd Learnings</h2>
            </td>
          </tr>

          <!-- Email Content -->
          <tr>
            <td class="content">
              ${customContentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <p>© ${new Date().getFullYear()} EmpowerEd Learnings. All rights reserved.</p>
              <p>You are receiving this email because of your activity on our platform.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
