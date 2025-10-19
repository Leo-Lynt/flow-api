const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Inicializa o transporter do nodemailer
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true para porta 465
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Envia um email
   * @param {Object} options - Opções do email
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `${process.env.APP_NAME || 'Flow-Forge'} <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}`);

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Remove tags HTML de uma string
   * @param {string} html - String HTML
   * @returns {string} Texto sem HTML
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Envia email de verificação de conta
   * @param {Object} user - Dados do usuário
   * @param {string} token - Token de verificação
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendVerificationEmail(user, token) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    // Log verification URL in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n==============================================');
      console.log('📧 EMAIL DE VERIFICAÇÃO');
      console.log('==============================================');
      console.log(`Para: ${user.email}`);
      console.log(`Link de verificação:\n${verificationUrl}`);
      console.log('==============================================\n');
    }

    const subject = 'Verifique seu email - Flow-Forge';
    const html = this.getVerificationEmailTemplate(user.name, verificationUrl);

    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Envia email de reset de senha
   * @param {Object} user - Dados do usuário
   * @param {string} token - Token de reset
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendResetPasswordEmail(user, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const subject = 'Recuperação de senha - Flow-Forge';
    const html = this.getResetPasswordEmailTemplate(user.name, resetUrl);

    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Envia email de confirmação de mudança de senha
   * @param {Object} user - Dados do usuário
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendPasswordChangedEmail(user) {
    const subject = 'Senha alterada - Flow-Forge';
    const html = this.getPasswordChangedEmailTemplate(user.name);

    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Envia email de confirmação de deleção de conta
   * @param {Object} user - Dados do usuário
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendAccountDeletedEmail(user) {
    const subject = 'Conta deletada - Flow-Forge';
    const html = this.getAccountDeletedEmailTemplate(user.name);

    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Envia email de boas-vindas
   * @param {Object} user - Dados do usuário
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendWelcomeEmail(user) {
    const subject = 'Bem-vindo ao Flow-Forge!';
    const html = this.getWelcomeEmailTemplate(user.name);

    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Template de email de verificação
   */
  getVerificationEmailTemplate(name, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificação de Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Flow-Forge</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Olá, ${name}!</h2>

          <p>Obrigado por se registrar no Flow-Forge. Para começar a usar sua conta, precisamos verificar seu endereço de email.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verificar Email
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">Se você não criou uma conta no Flow-Forge, pode ignorar este email.</p>

          <p style="color: #666; font-size: 14px;">Este link expira em 24 horas.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Flow-Forge. Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de email de reset de senha
   */
  getResetPasswordEmailTemplate(name, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperação de Senha</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Flow-Forge</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Olá, ${name}!</h2>

          <p>Recebemos uma solicitação para redefinir a senha da sua conta Flow-Forge.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Redefinir Senha
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">Se você não solicitou a redefinição de senha, pode ignorar este email. Sua senha permanecerá inalterada.</p>

          <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Flow-Forge. Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de email de senha alterada
   */
  getPasswordChangedEmailTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Senha Alterada</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Flow-Forge</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Olá, ${name}!</h2>

          <p>Sua senha foi alterada com sucesso.</p>

          <p style="color: #666; font-size: 14px;">Se você não realizou esta alteração, entre em contato conosco imediatamente.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Flow-Forge. Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de email de conta deletada
   */
  getAccountDeletedEmailTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conta Deletada</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Flow-Forge</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Até logo, ${name}!</h2>

          <p>Sua conta Flow-Forge foi deletada conforme solicitado.</p>

          <p>Sentiremos sua falta! Se você mudar de ideia, pode criar uma nova conta a qualquer momento.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Flow-Forge. Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de email de boas-vindas
   */
  getWelcomeEmailTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Flow-Forge</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Bem-vindo, ${name}!</h2>

          <p>Estamos muito felizes em ter você conosco no Flow-Forge!</p>

          <p>Com o Flow-Forge, você pode criar fluxos de transformação de dados de forma visual e intuitiva.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Começar Agora
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Flow-Forge. Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
