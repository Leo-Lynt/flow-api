const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');

class MK3DAdapter extends BaseAdapter {
  async fetch(config, resolvedDates, userId = null) {
    // Config esperado: { url, params, auth }
    this.validateConfig(config, ['url']);

    const {
      url,
      method = 'GET',
      params = {},
      headers = {},
      body,
      auth,
      dateParamNames = { start: 'startDate', end: 'endDate' }
    } = config;

    return this.fetchWithRetry(async () => {
      // Construir query params
      const queryParams = { ...params };

      // Adicionar datas automaticamente se resolvedDates existir
      if (resolvedDates) {
        queryParams[dateParamNames.start] = resolvedDates.startDate;
        queryParams[dateParamNames.end] = resolvedDates.endDate;
      }

      // Construir URL final com query params
      const finalUrl = this.buildUrlWithParams(url, queryParams);

      console.log('🚀 MK3D Request:', {
        url: finalUrl,
        method,
        params: queryParams
      });

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
        timeout: 25000,
        validateStatus: (status) => status >= 200 && status < 500
      });

      if (response.status >= 400) {
        throw new Error(`API retornou status ${response.status}: ${JSON.stringify(response.data)}`);
      }

      console.log('✅ MK3D Response:', {
        status: response.status,
        records: Array.isArray(response.data) ? response.data.length : 'N/A'
      });

      return response.data;
    });
  }

  buildUrlWithParams(baseUrl, params) {
    // Se não tem params, retorna URL base
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    // Usar URLSearchParams para montar query string corretamente
    const url = new URL(baseUrl);

    // Adicionar cada param
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });

    return url.toString();
  }
}

module.exports = MK3DAdapter;