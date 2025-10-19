const axios = require('axios');
const { google } = require('../utils/googleApis');
const oauthService = require('../services/oauthService');
const Connection = require('../models/Connection');
const nodemailer = require('nodemailer');

/**
 * API Response Output
 * Retorna dados formatados como resposta API
 */
exports.apiResponse = async (req, res) => {
  try {
    const { data, config, flowId } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Data is required'
      });
    }

    const { payloadType = 'data_only', statusCode = 200 } = config || {};

    let response;

    switch (payloadType) {
      case 'wrapped':
        response = {
          success: true,
          data
        };
        break;

      case 'full':
        response = {
          success: true,
          flowId: flowId || 'unknown',
          executedAt: new Date().toISOString(),
          data
        };
        break;

      case 'data_only':
      default:
        response = data;
        break;
    }

    return res.status(statusCode).json(response);
  } catch (error) {
    console.error('API Response error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error formatting API response',
      error: error.message
    });
  }
};

/**
 * Webhook Output
 * Envia dados para URL webhook
 */
exports.webhook = async (req, res) => {
  try {
    const { data, config } = req.body;

    if (!data || !config?.url) {
      return res.status(400).json({
        success: false,
        message: 'Data and config.url are required'
      });
    }

    const {
      url,
      method = 'POST',
      headers = {},
      retry = false
    } = config;

    const sendRequest = async (attempt = 1) => {
      try {
        await axios({
          method,
          url,
          data,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          timeout: 30000
        });
        return true;
      } catch (error) {
        if (retry && attempt < 3) {
          const delay = attempt === 1 ? 1000 : 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return sendRequest(attempt + 1);
        }
        throw error;
      }
    };

    await sendRequest();

    return res.json({
      success: true,
      message: 'Webhook delivered successfully'
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending webhook',
      error: error.message
    });
  }
};

/**
 * Email Output
 * Envia dados por email usando SMTP
 */
exports.email = async (req, res) => {
  try {
    const { data, config } = req.body;

    if (!data || !config?.to) {
      return res.status(400).json({
        success: false,
        message: 'Data and config.to are required'
      });
    }

    const {
      to,
      subject = 'FlowForge Output',
      format = 'html',
      smtpConfig
    } = config;

    const recipients = to.split(',').map(email => email.trim());

    // Configuração SMTP (pode vir do config ou das variáveis de ambiente)
    const transportConfig = smtpConfig || {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    // Verificar se SMTP está configurado
    if (!transportConfig.host || !transportConfig.auth?.user) {
      return res.status(400).json({
        success: false,
        message: 'SMTP not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASS in .env or provide smtpConfig',
        note: 'Example smtpConfig: { host: "smtp.gmail.com", port: 587, secure: false, auth: { user: "your@email.com", pass: "password" } }'
      });
    }

    const transporter = nodemailer.createTransport(transportConfig);

    let emailContent;
    let isHtml = false;
    let attachments = [];

    switch (format) {
      case 'html':
        emailContent = formatAsHTML(data);
        isHtml = true;
        break;

      case 'json':
        attachments = [{
          filename: 'data.json',
          content: JSON.stringify(data, null, 2),
          contentType: 'application/json'
        }];
        emailContent = `<p>FlowForge Output data attached.</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
        isHtml = true;
        break;

      case 'csv':
        const csvContent = formatAsCSV(data);
        attachments = [{
          filename: 'data.csv',
          content: csvContent,
          contentType: 'text/csv'
        }];
        emailContent = '<p>FlowForge Output data attached as CSV.</p>';
        isHtml = true;
        break;

      default:
        emailContent = JSON.stringify(data, null, 2);
    }

    const mailOptions = {
      from: transportConfig.auth.user,
      to: recipients.join(', '),
      subject,
      ...(isHtml ? { html: emailContent } : { text: emailContent }),
      attachments
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: `Email sent to ${recipients.length} recipient(s)`
    });
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending email',
      error: error.message
    });
  }
};

/**
 * Google Sheets Output
 * Escreve dados no Google Sheets usando OAuth
 */
exports.googleSheets = async (req, res) => {
  try {
    const { data, config } = req.body;
    const userId = req.user.userId;

    if (!data || !config?.spreadsheetUrl || !config?.connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Data, config.spreadsheetUrl, and config.connectionId are required'
      });
    }

    const {
      spreadsheetUrl,
      sheetName = 'Sheet1',
      writeMode = 'append',
      connectionId
    } = config;

    // Extrair spreadsheetId da URL
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid spreadsheet URL. Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit'
      });
    }

    // Obter token OAuth válido (suporta ID ou serviceType)
    let accessToken;
    if (connectionId.match(/^[0-9a-fA-F]{24}$/)) {
      // É um ID válido
      accessToken = await oauthService.getValidAccessToken(connectionId, userId);
    } else if (connectionId === 'google_sheets' || connectionId === 'sheets') {
      // Buscar por serviceType
      const Connection = require('../models/Connection');
      const connection = await Connection.findByService(userId, 'google', 'sheets');
      if (!connection) {
        return res.status(400).json({
          success: false,
          message: 'Nenhuma conexão Google Sheets encontrada. Conecte sua conta primeiro.'
        });
      }
      accessToken = await oauthService.getValidAccessToken(connection._id, userId);
    } else {
      accessToken = await oauthService.getValidAccessToken(connectionId, userId);
    }

    // Configurar cliente OAuth2
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Verificar se a aba existe, se não, criar
    try {
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });

      const sheetExists = sheetMetadata.data.sheets.some(
        sheet => sheet.properties.title === sheetName
      );

      if (!sheetExists) {
        console.log(`Aba "${sheetName}" não existe. Criando...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
        console.log(`✅ Aba "${sheetName}" criada com sucesso!`);
      }
    } catch (sheetError) {
      console.error('Erro ao verificar/criar aba:', sheetError.message);
      // Continuar mesmo se falhar - talvez a aba exista mas houve erro na verificação
    }

    // Preparar dados
    const rows = Array.isArray(data) ? data : [data];

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data to write'
      });
    }

    // Extrair headers e valores
    const headers = Object.keys(rows[0]);
    const values = rows.map(row =>
      headers.map(header => {
        const value = row[header];
        // Converter objetos/arrays para string JSON
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      })
    );

    let rowsWritten = 0;

    switch (writeMode) {
      case 'append':
        // Adicionar no final
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [headers, ...values]
          }
        });
        rowsWritten = rows.length;
        break;

      case 'replace':
        // Limpar e escrever
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A1:ZZ`
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [headers, ...values]
          }
        });
        rowsWritten = rows.length;
        break;

      case 'update':
        // Sobrescrever a partir de A1
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [headers, ...values]
          }
        });
        rowsWritten = rows.length;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid writeMode. Use: append, replace, or update'
        });
    }

    return res.json({
      success: true,
      message: `Data written to ${sheetName}`,
      rowsWritten,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    });

  } catch (error) {
    console.error('Google Sheets error:', error);

    // Erro de autenticação
    if (error.message.includes('token') || error.message.includes('auth')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication error. Please reconnect your Google account.',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error writing to Google Sheets',
      error: error.message
    });
  }
};

/**
 * Download Output
 * Gera arquivo para download
 */
exports.download = async (req, res) => {
  try {
    const { data, config } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Data is required'
      });
    }

    const {
      format = 'json',
      filename = 'output-data'
    } = config || {};

    let content;
    let contentType;
    let extension;

    switch (format) {
      case 'csv':
        content = formatAsCSV(data);
        contentType = 'text/csv';
        extension = 'csv';
        break;

      case 'excel':
        // Para Excel real, seria necessário usar biblioteca como 'xlsx'
        content = formatAsCSV(data);
        contentType = 'text/csv';
        extension = 'csv';
        break;

      case 'json':
      default:
        content = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        extension = 'json';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);

    return res.send(content);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating download',
      error: error.message
    });
  }
};

// Helper functions

function formatAsHTML(data) {
  const rows = Array.isArray(data) ? data : [data];

  if (rows.length === 0) return '<p>No data</p>';

  const keys = Object.keys(rows[0]);

  let html = '<html><body><table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">';
  html += '<thead><tr style="background-color: #4CAF50; color: white;">';
  keys.forEach(key => {
    html += `<th>${escapeHtml(key)}</th>`;
  });
  html += '</tr></thead><tbody>';

  rows.forEach((row, idx) => {
    const bgColor = idx % 2 === 0 ? '#f2f2f2' : 'white';
    html += `<tr style="background-color: ${bgColor};">`;
    keys.forEach(key => {
      const value = row[key];
      let displayValue = '';

      if (value === null || value === undefined) {
        displayValue = '';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }

      html += `<td>${escapeHtml(displayValue)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></body></html>';
  return html;
}

function formatAsCSV(data) {
  const rows = Array.isArray(data) ? data : [data];

  if (rows.length === 0) return '';

  const keys = Object.keys(rows[0]);
  let csv = keys.map(k => escapeCsv(k)).join(',') + '\n';

  rows.forEach(row => {
    const values = keys.map(key => {
      const value = row[key];

      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'object') {
        return escapeCsv(JSON.stringify(value));
      } else {
        return escapeCsv(String(value));
      }
    });
    csv += values.join(',') + '\n';
  });

  return csv;
}

function escapeCsv(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractSpreadsheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
