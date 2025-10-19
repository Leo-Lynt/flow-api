const crypto = require('crypto');

class TokenService {
  /**
   * Gera um token aleatório seguro
   * @param {number} length - Tamanho do token em bytes (padrão: 32)
   * @returns {string} Token em formato hexadecimal
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash de um token para armazenamento seguro
   * @param {string} token - Token a ser hasheado
   * @returns {string} Token hasheado
   */
  hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * Gera um token de verificação de email
   * @returns {Object} { token, hashedToken, expires }
   */
  generateVerificationToken() {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    return {
      token,
      hashedToken,
      expires
    };
  }

  /**
   * Gera um token de reset de senha
   * @returns {Object} { token, hashedToken, expires }
   */
  generateResetPasswordToken() {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    return {
      token,
      hashedToken,
      expires
    };
  }

  /**
   * Gera códigos de backup para 2FA
   * @param {number} count - Quantidade de códigos (padrão: 10)
   * @returns {string[]} Array de códigos de backup
   */
  generateBackupCodes(count = 10) {
    const codes = [];

    for (let i = 0; i < count; i++) {
      // Gera código de 8 caracteres alfanuméricos
      const code = crypto
        .randomBytes(4)
        .toString('hex')
        .toUpperCase()
        .match(/.{1,4}/g)
        .join('-');

      codes.push(code);
    }

    return codes;
  }

  /**
   * Hash de códigos de backup para armazenamento
   * @param {string[]} codes - Array de códigos
   * @returns {string[]} Array de códigos hasheados
   */
  hashBackupCodes(codes) {
    return codes.map(code => this.hashToken(code));
  }

  /**
   * Verifica se um token está expirado
   * @param {Date} expiresAt - Data de expiração
   * @returns {boolean} True se expirado
   */
  isTokenExpired(expiresAt) {
    return !expiresAt || new Date() > new Date(expiresAt);
  }

  /**
   * Gera um código numérico de N dígitos
   * @param {number} digits - Número de dígitos (padrão: 6)
   * @returns {string} Código numérico
   */
  generateNumericCode(digits = 6) {
    const max = Math.pow(10, digits);
    const code = crypto.randomInt(0, max);
    return code.toString().padStart(digits, '0');
  }
}

module.exports = new TokenService();
