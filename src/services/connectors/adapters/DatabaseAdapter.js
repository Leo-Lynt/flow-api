const BaseAdapter = require('./BaseAdapter');
const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');
const sql = require('mssql');

class DatabaseAdapter extends BaseAdapter {
  async fetch(config, resolvedDates, userId = null) {
    this.validateConfig(config, ['type', 'query', 'connection']);

    const { type, query, connection, dateField, params = [] } = config;

    return this.fetchWithRetry(async () => {
      let client;
      let result;

      try {
        switch (type.toLowerCase()) {
          case 'postgresql':
          case 'postgres':
            result = await this.fetchPostgreSQL(connection, query, params, dateField, resolvedDates);
            break;

          case 'mysql':
            result = await this.fetchMySQL(connection, query, params, dateField, resolvedDates);
            break;

          case 'sqlserver':
          case 'mssql':
            result = await this.fetchSQLServer(connection, query, params, dateField, resolvedDates);
            break;

          default:
            throw new Error(`Tipo de banco de dados não suportado: ${type}`);
        }

        return result;
      } catch (error) {
        throw new Error(`Erro ao executar query no banco ${type}: ${error.message}`);
      }
    });
  }

  async fetchPostgreSQL(connection, query, params, dateField, resolvedDates) {
    const client = new PgClient({
      host: connection.host,
      port: connection.port || 5432,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      ssl: connection.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000
    });

    try {
      await client.connect();

      let finalQuery = query;
      let finalParams = [...params];

      if (resolvedDates && dateField) {
        const result = this.addDateFilterPostgres(query, dateField, resolvedDates, params.length);
        finalQuery = result.query;
        finalParams = [...finalParams, resolvedDates.startDate, resolvedDates.endDate];
      }

      const result = await client.query(finalQuery, finalParams);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  async fetchMySQL(connection, query, params, dateField, resolvedDates) {
    const mysqlConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port || 3306,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000
    });

    try {
      let finalQuery = query;
      let finalParams = [...params];

      if (resolvedDates && dateField) {
        const result = this.addDateFilterMySQL(query, dateField, resolvedDates);
        finalQuery = result.query;
        finalParams = [...finalParams, resolvedDates.startDate, resolvedDates.endDate];
      }

      const [rows] = await mysqlConnection.execute(finalQuery, finalParams);
      return rows;
    } finally {
      await mysqlConnection.end();
    }
  }

  async fetchSQLServer(connection, query, params, dateField, resolvedDates) {
    const config = {
      server: connection.host,
      port: connection.port || 1433,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      options: {
        encrypt: connection.ssl || false,
        trustServerCertificate: true,
        connectTimeout: 10000
      }
    };

    const pool = await sql.connect(config);

    try {
      let finalQuery = query;

      if (resolvedDates && dateField) {
        finalQuery = this.addDateFilterSQLServer(query, dateField, resolvedDates);
      }

      const request = pool.request();

      // Add parameters
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });

      if (resolvedDates && dateField) {
        request.input('startDate', resolvedDates.startDate);
        request.input('endDate', resolvedDates.endDate);
      }

      const result = await request.query(finalQuery);
      return result.recordset;
    } finally {
      await pool.close();
    }
  }

  addDateFilterPostgres(query, dateField, resolvedDates, paramCount) {
    const startParam = `$${paramCount + 1}`;
    const endParam = `$${paramCount + 2}`;
    const dateFilter = `${dateField} BETWEEN ${startParam} AND ${endParam}`;

    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('where')) {
      return { query: query.replace(/where/i, `WHERE ${dateFilter} AND (`).replace(/;?\s*$/, ') $&') };
    } else {
      return { query: query.replace(/;?\s*$/, ` WHERE ${dateFilter}$&`) };
    }
  }

  addDateFilterMySQL(query, dateField, resolvedDates) {
    const dateFilter = `${dateField} BETWEEN ? AND ?`;
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('where')) {
      return { query: query.replace(/where/i, `WHERE ${dateFilter} AND (`).replace(/;?\s*$/, ') $&') };
    } else {
      return { query: query.replace(/;?\s*$/, ` WHERE ${dateFilter}$&`) };
    }
  }

  addDateFilterSQLServer(query, dateField, resolvedDates) {
    const dateFilter = `${dateField} BETWEEN @startDate AND @endDate`;
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('where')) {
      return query.replace(/where/i, `WHERE ${dateFilter} AND (`).replace(/;?\s*$/, ') $&');
    } else {
      return query.replace(/;?\s*$/, ` WHERE ${dateFilter}$&`);
    }
  }
}

module.exports = DatabaseAdapter;