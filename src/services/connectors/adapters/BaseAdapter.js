class BaseAdapter {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 segundo
  }

  async fetch(config, resolvedDates) {
    throw new Error('Método fetch deve ser implementado pela subclasse');
  }

  async fetchWithRetry(fetchFn, attempt = 1) {
    try {
      return await fetchFn();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      // Backoff exponencial
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      console.log(`Tentativa ${attempt} falhou. Tentando novamente em ${delay}ms...`);

      await this.sleep(delay);
      return this.fetchWithRetry(fetchFn, attempt + 1);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validateConfig(config, requiredFields) {
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Campo obrigatório ausente: ${field}`);
      }
    }
  }
}

module.exports = BaseAdapter;