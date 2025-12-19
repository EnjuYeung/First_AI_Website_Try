import nodemailer from 'nodemailer';

export const createEmail = ({ smtp }) => {
  const hasSmtpConfig = !!(smtp.host && smtp.port && smtp.user && smtp.pass);
  const transporter = hasSmtpConfig
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      })
    : null;

  const sendEmailMessage = async (to, subject, text) => {
    if (!transporter) {
      throw new Error('smtp_not_configured');
    }
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to,
      subject,
      text,
    });
  };

  return { sendEmailMessage, hasSmtpConfig };
};

