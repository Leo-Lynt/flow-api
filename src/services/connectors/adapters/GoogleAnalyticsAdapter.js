const BaseAdapter = require('./BaseAdapter');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { google } = require('../../../utils/googleApis');
const oauthService = require('../../oauthService');

class GoogleAnalyticsAdapter extends BaseAdapter {
  async fetch(config, resolvedDates, userId = null) {
    // Suporte para OAuth ou Service Account
    const {
      propertyId,
      connectionId, // Para OAuth
      credentials,  // Para Service Account (legado)
      metrics = [],
      dimensions = [],
      limit = 1000
    } = config;

    // Validar que tem propertyId e pelo menos uma forma de autenticação
    if (!propertyId) {
      throw new Error('propertyId é obrigatório');
    }

    if (!connectionId && !credentials) {
      throw new Error('connectionId ou credentials são obrigatórios');
    }

    return this.fetchWithRetry(async () => {
      let analyticsDataClient;

      // Usar OAuth se connectionId for fornecido
      if (connectionId && userId) {
        // Buscar connection por ID ou por service type
        let connection;
        if (connectionId.match(/^[0-9a-fA-F]{24}$/)) {
          // É um ID válido do MongoDB
          const accessToken = await oauthService.getValidAccessToken(connectionId, userId);
          connection = { accessToken };
        } else if (connectionId === 'google_analytics' || connectionId === 'analytics') {
          // Buscar por serviceType
          const Connection = require('../../models/Connection');
          connection = await Connection.findByService(userId, 'google', 'analytics');
          if (!connection) {
            throw new Error('Nenhuma conexão Google Analytics encontrada. Conecte sua conta primeiro.');
          }
          const accessToken = await oauthService.getValidAccessToken(connection._id, userId);
          connection.accessToken = accessToken;
        }

        const accessToken = connection.accessToken;

        // Criar cliente OAuth2 do googleapis
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: accessToken });

        // Passar auth para o BetaAnalyticsDataClient
        analyticsDataClient = new BetaAnalyticsDataClient({
          authClient: auth
        });
      } else {
        // Usar Service Account (modo legado)
        analyticsDataClient = new BetaAnalyticsDataClient({
          credentials: this.parseCredentials(credentials)
        });
      }

      // Preparar date ranges
      const dateRanges = this.prepareDateRanges(resolvedDates);

      // Preparar métricas (padrões se não fornecidas)
      const requestMetrics = metrics.length > 0
        ? metrics.map(m => ({ name: m }))
        : [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' }
          ];

      // Preparar dimensões (padrões se não fornecidas)
      const requestDimensions = dimensions.length > 0
        ? dimensions.map(d => ({ name: d }))
        : [
            { name: 'date' },
            { name: 'country' }
          ];

      // Fazer requisição ao GA4
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges,
        metrics: requestMetrics,
        dimensions: requestDimensions,
        limit
      });

      // Processar resposta
      return this.processResponse(response);
    });
  }

  parseCredentials(credentials) {
    // Se já for um objeto, retornar diretamente
    if (typeof credentials === 'object') {
      return credentials;
    }

    // Se for string JSON, fazer parse
    if (typeof credentials === 'string') {
      try {
        return JSON.parse(credentials);
      } catch (error) {
        throw new Error('Credenciais inválidas. Deve ser um objeto JSON válido.');
      }
    }

    throw new Error('Formato de credenciais não suportado');
  }

  prepareDateRanges(resolvedDates) {
    if (!resolvedDates) {
      // Se não fornecido, usar últimos 30 dias
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      return [{
        startDate: this.formatDateForGA(startDate),
        endDate: this.formatDateForGA(endDate)
      }];
    }

    return [{
      startDate: resolvedDates.startDate,
      endDate: resolvedDates.endDate
    }];
  }

  formatDateForGA(date) {
    // GA4 aceita YYYY-MM-DD
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return date;
  }

  processResponse(response) {
    const data = [];

    if (!response.rows || response.rows.length === 0) {
      return data;
    }

    // Extrair nomes das dimensões e métricas
    const dimensionHeaders = response.dimensionHeaders.map(h => h.name);
    const metricHeaders = response.metricHeaders.map(h => h.name);

    // Processar cada linha
    for (const row of response.rows) {
      const rowData = {};

      // Adicionar dimensões
      row.dimensionValues.forEach((value, index) => {
        rowData[dimensionHeaders[index]] = value.value;
      });

      // Adicionar métricas
      row.metricValues.forEach((value, index) => {
        const metricName = metricHeaders[index];
        // Tentar converter para número
        const numValue = parseFloat(value.value);
        rowData[metricName] = isNaN(numValue) ? value.value : numValue;
      });

      data.push(rowData);
    }

    return data;
  }
}

module.exports = GoogleAnalyticsAdapter;