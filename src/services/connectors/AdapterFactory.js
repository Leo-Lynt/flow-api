const APIAdapter = require('./adapters/APIAdapter');
const GoogleAnalyticsAdapter = require('./adapters/GoogleAnalyticsAdapter');
const GoogleSheetsAdapter = require('./adapters/GoogleSheetsAdapter');
const MK3DAdapter = require('./adapters/MK3DAdapter');
const GraphQLAdapter = require('./adapters/GraphQLAdapter');
const JSONAdapter = require('./adapters/JSONAdapter');
const DatabaseAdapter = require('./adapters/DatabaseAdapter');

class AdapterFactory {
  constructor() {
    this.adapters = {
      api: new APIAdapter(),
      analytics: new GoogleAnalyticsAdapter(),
      sheets: new GoogleSheetsAdapter(),
      mk3d: new MK3DAdapter(),
      graphql: new GraphQLAdapter(),
      json: new JSONAdapter(),
      database: new DatabaseAdapter()
    };
  }

  getAdapter(sourceType) {
    const adapter = this.adapters[sourceType];

    if (!adapter) {
      throw new Error(`Tipo de fonte não suportado: ${sourceType}`);
    }

    return adapter;
  }
}

module.exports = AdapterFactory;