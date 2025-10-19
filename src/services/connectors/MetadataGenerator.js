class MetadataGenerator {
  generate(data) {
    const metadata = {
      totalRecords: 0,
      dataType: this.getDataType(data),
      schema: null
    };

    if (Array.isArray(data)) {
      metadata.totalRecords = data.length;

      if (data.length > 0) {
        metadata.schema = this.inferSchema(data[0]);
      }
    } else if (typeof data === 'object' && data !== null) {
      metadata.totalRecords = 1;
      metadata.schema = this.inferSchema(data);
    }

    return metadata;
  }

  getDataType(data) {
    if (Array.isArray(data)) {
      return 'array';
    }
    if (data === null) {
      return 'null';
    }
    return typeof data;
  }

  inferSchema(sample) {
    const schema = {
      fields: []
    };

    if (typeof sample !== 'object' || sample === null) {
      return schema;
    }

    for (const [key, value] of Object.entries(sample)) {
      schema.fields.push({
        name: key,
        type: this.inferFieldType(value),
        nullable: value === null || value === undefined
      });
    }

    return schema;
  }

  inferFieldType(value) {
    if (value === null || value === undefined) {
      return 'unknown';
    }

    if (Array.isArray(value)) {
      return 'array';
    }

    const type = typeof value;

    if (type === 'object') {
      return 'object';
    }

    if (type === 'number') {
      return Number.isInteger(value) ? 'integer' : 'float';
    }

    if (type === 'string') {
      // Tentar detectar tipos especiais
      if (this.isDateString(value)) {
        return 'date';
      }
      if (this.isEmailString(value)) {
        return 'email';
      }
      if (this.isUrlString(value)) {
        return 'url';
      }
      return 'string';
    }

    return type;
  }

  isDateString(str) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
    return dateRegex.test(str) && !isNaN(Date.parse(str));
  }

  isEmailString(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  isUrlString(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = MetadataGenerator;