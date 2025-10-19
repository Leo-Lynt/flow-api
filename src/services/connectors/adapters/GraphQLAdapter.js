const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');

class GraphQLAdapter extends BaseAdapter {
  async fetch(config, resolvedDates, userId = null) {
    this.validateConfig(config, ['url', 'query']);

    const {
      url,
      query,
      variables = {},
      operationName,
      headers = {},
      auth
    } = config;

    return this.fetchWithRetry(async () => {
      // Preparar variables
      const finalVariables = { ...variables };

      // Injetar datas automaticamente se resolvedDates existir
      if (resolvedDates) {
        // Verificar se a query usa variáveis de data
        const usesStartDate = query.includes('$startDate');
        const usesEndDate = query.includes('$endDate');

        if (usesStartDate) {
          finalVariables.startDate = resolvedDates.startDate;
        }
        if (usesEndDate) {
          finalVariables.endDate = resolvedDates.endDate;
        }

        console.log('📅 Datas injetadas nas variables:', {
          startDate: finalVariables.startDate,
          endDate: finalVariables.endDate
        });
      }

      // Configurar headers
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };

      // Adicionar autenticação
      if (auth) {
        if (auth.type === 'bearer') {
          requestHeaders['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'apikey') {
          requestHeaders[auth.headerName || 'X-API-Key'] = auth.apiKey;
        }
      }

      console.log('🔷 GraphQL Request:', {
        url,
        operationName: operationName || 'anonymous',
        variables: Object.keys(finalVariables)
      });

      // Preparar body GraphQL
      const body = {
        query,
        variables: finalVariables
      };

      if (operationName) {
        body.operationName = operationName;
      }

      // Fazer requisição GraphQL
      const response = await axios({
        method: 'POST',
        url,
        headers: requestHeaders,
        data: body,
        timeout: 25000,
        validateStatus: (status) => status >= 200 && status < 500
      });

      // Verificar erros HTTP
      if (response.status >= 400) {
        throw new Error(`GraphQL endpoint retornou status ${response.status}`);
      }

      // Verificar estrutura da resposta GraphQL
      if (!response.data) {
        throw new Error('Resposta GraphQL vazia');
      }

      // Verificar erros GraphQL
      if (response.data.errors && response.data.errors.length > 0) {
        const errorMessages = response.data.errors.map(err => err.message).join(', ');
        throw new Error(`Erros GraphQL: ${errorMessages}`);
      }

      // Extrair dados
      const data = response.data.data;

      if (!data) {
        throw new Error('Nenhum dado retornado pela query GraphQL');
      }

      console.log('✅ GraphQL Response:', {
        fields: Object.keys(data),
        dataSize: JSON.stringify(data).length
      });

      // Se data for objeto com um único campo, extrair automaticamente
      const dataKeys = Object.keys(data);
      if (dataKeys.length === 1) {
        const singleField = data[dataKeys[0]];
        console.log(`📦 Extraindo campo único: ${dataKeys[0]}`);
        return singleField;
      }

      return data;
    });
  }
}

module.exports = GraphQLAdapter;