const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');

class APIAdapter extends BaseAdapter {
  async fetch(config, resolvedDates) {
    this.validateConfig(config, ['url']);

    const { url, method = 'GET', headers = {}, body, auth } = config;

    return this.fetchWithRetry(async () => {
      // Construir URL com parâmetros de data se fornecidos
      let finalUrl = url;
      if (resolvedDates) {
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}start_date=${resolvedDates.startDate}&end_date=${resolvedDates.endDate}`;
      }

      // Configurar headers de autenticação
      const requestHeaders = { ...headers };
      if (auth) {
        if (auth.type === 'bearer') {
          requestHeaders['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'apikey') {
          requestHeaders[auth.headerName || 'X-API-Key'] = auth.apiKey;
        }
      }

      // Fazer requisição
      const response = await axios({
        method,
        url: finalUrl,
        headers: requestHeaders,
        data: body,
        timeout: 25000, // 25 segundos (menor que o timeout geral)
        validateStatus: (status) => status >= 200 && status < 500
      });

      if (response.status >= 400) {
        throw new Error(`API retornou status ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    });
  }
}

module.exports = APIAdapter;