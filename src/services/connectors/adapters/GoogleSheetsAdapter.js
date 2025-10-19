const BaseAdapter = require('./BaseAdapter');
const { google } = require('../../../utils/googleApis');

class GoogleSheetsAdapter extends BaseAdapter {
  async fetch(config, resolvedDates, userId = null) {
    // Config esperado: { url }
    const {
      url,
      sheetName, // Opcional: nome da aba (se não informado, pega a primeira)
      range, // Opcional: range específico (ex: "A1:D100")
      includeHeaders = true
    } = config;

    if (!url) {
      throw new Error('URL do Google Sheets é obrigatório');
    }

    // Verificar se tem API Key configurada
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY não configurada no servidor. Configure no .env');
    }

    // Extrair spreadsheetId da URL
    const spreadsheetId = this.extractSpreadsheetId(url);

    if (!spreadsheetId) {
      throw new Error('URL inválida do Google Sheets');
    }

    return this.fetchWithRetry(async () => {
      // Acessar planilha pública via API Key
      const sheets = google.sheets({
        version: 'v4',
        auth: process.env.GOOGLE_API_KEY
      });

      // Determinar range
      let finalRange = range;

      if (!finalRange) {
        // Se não especificou range, buscar primeira aba
        if (sheetName) {
          finalRange = sheetName;
        } else {
          // Buscar nome da primeira aba
          const metadataResponse = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties.title'
          });

          const firstSheet = metadataResponse.data.sheets[0];
          finalRange = firstSheet.properties.title;
        }
      }

      console.log(`📊 Buscando dados do Google Sheets: ${spreadsheetId} / ${finalRange}`);

      // Buscar dados
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: finalRange
      });

      const rows = response.data.values;

      if (!rows || rows.length === 0) {
        return [];
      }

      // Processar dados
      return this.processRows(rows, includeHeaders, resolvedDates);
    });
  }

  extractSpreadsheetId(url) {
    // Formatos suportados:
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID

    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/ // Se passar só o ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  processRows(rows, includeHeaders, resolvedDates) {
    if (rows.length === 0) return [];

    let headers;
    let dataRows;

    if (includeHeaders) {
      headers = rows[0];
      dataRows = rows.slice(1);
    } else {
      // Gerar headers genéricos: col_0, col_1, etc
      headers = rows[0].map((_, i) => `col_${i}`);
      dataRows = rows;
    }

    // Converter para array de objetos
    const data = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });

    // Aplicar filtro de data se fornecido
    if (resolvedDates && resolvedDates.dateField) {
      return this.filterByDate(data, resolvedDates.dateField, resolvedDates);
    }

    return data;
  }

  filterByDate(data, dateField, resolvedDates) {
    if (!Array.isArray(data)) return data;

    const startDate = new Date(resolvedDates.startDate);
    const endDate = new Date(resolvedDates.endDate);

    return data.filter(item => {
      const itemDateStr = item[dateField];
      if (!itemDateStr) return false;

      try {
        const itemDate = new Date(itemDateStr);
        return itemDate >= startDate && itemDate <= endDate;
      } catch {
        return false;
      }
    });
  }
}

module.exports = GoogleSheetsAdapter;