class TemporalResolver {
  constructor() {
    this.relativeRanges = {
      today: () => {
        const today = new Date();
        return {
          startDate: this.formatDate(today),
          endDate: this.formatDate(today)
        };
      },
      last_7_days: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
          startDate: this.formatDate(start),
          endDate: this.formatDate(end)
        };
      },
      last_30_days: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
          startDate: this.formatDate(start),
          endDate: this.formatDate(end)
        };
      },
      last_90_days: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 90);
        return {
          startDate: this.formatDate(start),
          endDate: this.formatDate(end)
        };
      },
      this_month: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
          startDate: this.formatDate(start),
          endDate: this.formatDate(end)
        };
      },
      last_month: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: this.formatDate(start),
          endDate: this.formatDate(end)
        };
      }
    };
  }

  resolve(temporalConfig) {
    const { rangeType, relativeRange, absoluteRange, timezone } = temporalConfig;

    if (rangeType === 'relative') {
      if (!this.relativeRanges[relativeRange]) {
        throw new Error(`Range relativo não suportado: ${relativeRange}`);
      }
      return this.relativeRanges[relativeRange]();
    }

    if (rangeType === 'absolute') {
      if (!absoluteRange || !absoluteRange.startDate || !absoluteRange.endDate) {
        throw new Error('Range absoluto requer startDate e endDate');
      }

      // Validar formato de datas
      const startDate = new Date(absoluteRange.startDate);
      const endDate = new Date(absoluteRange.endDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Formato de data inválido');
      }

      if (startDate > endDate) {
        throw new Error('startDate deve ser anterior a endDate');
      }

      return {
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate)
      };
    }

    throw new Error(`Tipo de range não suportado: ${rangeType}`);
  }

  formatDate(date) {
    // Formato: YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Formatar para diferentes sistemas
  formatForGA(date) {
    // Google Analytics: YYYYMMDD
    return date.replace(/-/g, '');
  }

  formatForSQL(date) {
    // SQL: YYYY-MM-DD
    return date;
  }
}

module.exports = TemporalResolver;