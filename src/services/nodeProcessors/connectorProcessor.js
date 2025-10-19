const axios = require('axios');

class ConnectorProcessor {
  async process(node, context = {}) {
    try {
      const { data } = node;
      const { sourceType, analyticsType, apiUrl, dataPath } = data;

      let result;

      // Se for fonte mock/analytics
      if (sourceType === 'analytics') {
        result = this.getAnalyticsData(analyticsType);
      }
      // Se for API externa
      else if (sourceType === 'api' && apiUrl) {
        result = await this.fetchFromAPI(apiUrl, dataPath);
      }
      // Se for dados de entrada
      else if (sourceType === 'input') {
        result = context.inputData || {};
      }
      // Dados estáticos
      else if (sourceType === 'static' && data.staticData) {
        result = data.staticData;
      }
      else {
        throw new Error(`Tipo de fonte não suportado: ${sourceType}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          sourceType,
          timestamp: new Date().toISOString(),
          recordCount: Array.isArray(result) ? result.length : 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // Gerar dados mock para diferentes tipos de analytics
  getAnalyticsData(type) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    switch (type) {
      case 'sales':
        return this.generateSalesData();

      case 'users':
        return this.generateUsersData();

      case 'traffic':
        return this.generateTrafficData();

      case 'revenue':
        return this.generateRevenueData();

      default:
        return {
          message: `Dados mock para ${type}`,
          generatedAt: now.toISOString(),
          type
        };
    }
  }

  generateSalesData() {
    const sales = [];
    const products = ['Produto A', 'Produto B', 'Produto C', 'Produto D'];

    for (let i = 0; i < 100; i++) {
      sales.push({
        id: `sale_${i + 1}`,
        product: products[Math.floor(Math.random() * products.length)],
        amount: parseFloat((Math.random() * 1000 + 50).toFixed(2)),
        quantity: Math.floor(Math.random() * 10) + 1,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        customer: `Cliente ${i + 1}`,
        region: ['Norte', 'Sul', 'Leste', 'Oeste'][Math.floor(Math.random() * 4)]
      });
    }

    return {
      sales,
      summary: {
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, sale) => sum + sale.amount, 0),
        averageOrderValue: sales.reduce((sum, sale) => sum + sale.amount, 0) / sales.length
      }
    };
  }

  generateUsersData() {
    const users = [];
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'empresa.com'];

    for (let i = 0; i < 50; i++) {
      users.push({
        id: `user_${i + 1}`,
        name: `Usuário ${i + 1}`,
        email: `usuario${i + 1}@${domains[Math.floor(Math.random() * domains.length)]}`,
        age: Math.floor(Math.random() * 60) + 18,
        registeredAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: Math.random() > 0.3,
        plan: ['free', 'basic', 'premium'][Math.floor(Math.random() * 3)]
      });
    }

    return {
      users,
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive).length,
        planDistribution: users.reduce((acc, user) => {
          acc[user.plan] = (acc[user.plan] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }

  generateTrafficData() {
    const traffic = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      traffic.push({
        date: date.toISOString().split('T')[0],
        pageViews: Math.floor(Math.random() * 10000) + 1000,
        uniqueVisitors: Math.floor(Math.random() * 5000) + 500,
        bounceRate: parseFloat((Math.random() * 0.5 + 0.2).toFixed(2)),
        avgSessionDuration: Math.floor(Math.random() * 300) + 60 // segundos
      });
    }

    return {
      traffic: traffic.reverse(),
      summary: {
        totalPageViews: traffic.reduce((sum, day) => sum + day.pageViews, 0),
        totalUniqueVisitors: traffic.reduce((sum, day) => sum + day.uniqueVisitors, 0),
        avgBounceRate: traffic.reduce((sum, day) => sum + day.bounceRate, 0) / traffic.length
      }
    };
  }

  generateRevenueData() {
    const revenue = [];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 0; i < 12; i++) {
      revenue.push({
        month: months[i],
        revenue: parseFloat((Math.random() * 50000 + 10000).toFixed(2)),
        costs: parseFloat((Math.random() * 30000 + 5000).toFixed(2)),
        profit: 0 // Será calculado depois
      });
    }

    // Calcular lucro
    revenue.forEach(item => {
      item.profit = parseFloat((item.revenue - item.costs).toFixed(2));
    });

    return {
      revenue,
      summary: {
        totalRevenue: revenue.reduce((sum, month) => sum + month.revenue, 0),
        totalCosts: revenue.reduce((sum, month) => sum + month.costs, 0),
        totalProfit: revenue.reduce((sum, month) => sum + month.profit, 0)
      }
    };
  }

  // Buscar dados de API externa
  async fetchFromAPI(url, dataPath = '') {
    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10 segundos
        headers: {
          'User-Agent': 'Flow-Forge-API/1.0'
        }
      });

      let data = response.data;

      // Se especificou um caminho, navegar até ele
      if (dataPath) {
        const pathParts = dataPath.split('.');
        for (const part of pathParts) {
          if (data && typeof data === 'object' && part in data) {
            data = data[part];
          } else {
            throw new Error(`Caminho '${dataPath}' não encontrado nos dados da API`);
          }
        }
      }

      return data;

    } catch (error) {
      if (error.response) {
        throw new Error(`Erro HTTP ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Erro de rede: Não foi possível conectar à API');
      } else {
        throw new Error(`Erro na requisição: ${error.message}`);
      }
    }
  }
}

module.exports = new ConnectorProcessor();