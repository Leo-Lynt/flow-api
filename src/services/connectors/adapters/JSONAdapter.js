const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const { parse } = require('csv-parse/sync');

class JSONAdapter extends BaseAdapter {
  constructor() {
    super();
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  async fetch(config, resolvedDates, userId = null) {
    this.validateConfig(config, ['url']);

    const {
      url,
      format, // 'json' ou 'csv' (auto-detecta se não informado)
      dateField, // Campo para filtro de data
      csvDelimiter = ',',
      csvHeaders = true,
      headers = {}
    } = config;

    return this.fetchWithRetry(async () => {
      console.log('📄 Buscando arquivo:', url);

      // Fazer request para obter arquivo
      const response = await axios({
        method: 'GET',
        url,
        headers,
        timeout: 30000,
        maxContentLength: this.maxFileSize,
        responseType: 'text' // Receber como texto para processar
      });

      // Verificar tamanho
      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > this.maxFileSize) {
        throw new Error(`Arquivo muito grande: ${this.formatBytes(contentLength)}. Máximo: ${this.formatBytes(this.maxFileSize)}`);
      }

      console.log('✅ Arquivo obtido:', {
        size: this.formatBytes(response.data.length),
        contentType: response.headers['content-type']
      });

      // Auto-detectar formato
      const detectedFormat = format || this.detectFormat(url, response.headers['content-type']);

      // Parse de acordo com formato
      let data;
      if (detectedFormat === 'csv') {
        data = this.parseCSV(response.data, csvDelimiter, csvHeaders);
      } else {
        data = this.parseJSON(response.data);
      }

      console.log('📊 Dados parseados:', {
        format: detectedFormat,
        records: Array.isArray(data) ? data.length : 'N/A'
      });

      // Aplicar filtro de data se fornecido
      if (resolvedDates && dateField) {
        data = this.filterByDate(data, dateField, resolvedDates);
        console.log('📅 Após filtro de data:', {
          records: Array.isArray(data) ? data.length : 'N/A',
          range: `${resolvedDates.startDate} - ${resolvedDates.endDate}`
        });
      }

      return data;
    });
  }

  detectFormat(url, contentType) {
    // Detectar por extensão
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.csv')) {
      return 'csv';
    }
    if (urlLower.endsWith('.json')) {
      return 'json';
    }

    // Detectar por content-type
    if (contentType) {
      if (contentType.includes('csv')) {
        return 'csv';
      }
      if (contentType.includes('json')) {
        return 'json';
      }
    }

    // Padrão: JSON
    return 'json';
  }

  parseJSON(content) {
    try {
      const data = JSON.parse(content);

      // Se for objeto com array dentro, tentar extrair
      if (!Array.isArray(data) && typeof data === 'object') {
        // Procurar pelo primeiro array no objeto
        for (const key in data) {
          if (Array.isArray(data[key])) {
            console.log(`📦 Extraindo array da chave: ${key}`);
            return data[key];
          }
        }
      }

      return data;
    } catch (error) {
      throw new Error(`Erro ao fazer parse do JSON: ${error.message}`);
    }
  }

  parseCSV(content, delimiter, hasHeaders) {
    try {
      const records = parse(content, {
        delimiter,
        columns: hasHeaders, // Se true, usa primeira linha como headers
        skip_empty_lines: true,
        trim: true,
        cast: true, // Tenta converter tipos automaticamente
        cast_date: false // Não converter datas automaticamente (vamos fazer manual)
      });

      console.log('📋 CSV parseado:', {
        rows: records.length,
        columns: hasHeaders && records.length > 0 ? Object.keys(records[0]).length : 'N/A'
      });

      return records;
    } catch (error) {
      throw new Error(`Erro ao fazer parse do CSV: ${error.message}`);
    }
  }

  filterByDate(data, dateField, resolvedDates) {
    if (!Array.isArray(data)) {
      console.warn('⚠️  Dados não são array, pulando filtro de data');
      return data;
    }

    const startDate = new Date(resolvedDates.startDate);
    const endDate = new Date(resolvedDates.endDate);

    // Ajustar endDate para incluir o dia todo
    endDate.setHours(23, 59, 59, 999);

    const filtered = data.filter(item => {
      const itemDateStr = item[dateField];

      if (!itemDateStr) {
        return false;
      }

      try {
        const itemDate = new Date(itemDateStr);

        // Verificar se data é válida
        if (isNaN(itemDate.getTime())) {
          return false;
        }

        return itemDate >= startDate && itemDate <= endDate;
      } catch {
        return false;
      }
    });

    return filtered;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = JSONAdapter;