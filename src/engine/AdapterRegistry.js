/**
 * AdapterRegistry (CommonJS wrapper)
 * Wraps core AdapterRegistry for use in API
 */

class AdapterRegistry {
  constructor() {
    this.dataSources = new Map();
    this.outputDestinations = new Map();
  }

  registerDataSource(sourceType, adapter) {
    this.dataSources.set(sourceType, adapter);
  }

  getDataSource(sourceType) {
    return this.dataSources.get(sourceType) || null;
  }

  hasDataSource(sourceType) {
    return this.dataSources.has(sourceType);
  }

  registerOutputDestination(destinationType, adapter) {
    this.outputDestinations.set(destinationType, adapter);
  }

  getOutputDestination(destinationType) {
    return this.outputDestinations.get(destinationType) || null;
  }

  hasOutputDestination(destinationType) {
    return this.outputDestinations.has(destinationType);
  }

  listDataSources() {
    return Array.from(this.dataSources.keys());
  }

  listOutputDestinations() {
    return Array.from(this.outputDestinations.keys());
  }

  clear() {
    this.dataSources.clear();
    this.outputDestinations.clear();
  }
}

module.exports = { AdapterRegistry };
