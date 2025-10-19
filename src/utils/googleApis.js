/**
 * Wrapper leve para Google APIs
 * Substitui o pacote gigante 'googleapis' por implementações específicas
 */

const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

/**
 * Google Auth
 */
class GoogleAuth {
  constructor() {
    this.OAuth2 = OAuth2Client;
  }

  oauth2(config) {
    return new GoogleOAuth2API(config.auth);
  }
}

class GoogleOAuth2API {
  constructor(auth) {
    this.auth = auth;
  }

  userinfo = {
    get: async () => {
      const token = this.auth.credentials.access_token;
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { data: response.data };
    }
  };
}

/**
 * Google Sheets API
 */
class GoogleSheetsAPI {
  constructor(config) {
    this.auth = config.auth;
    this.version = config.version;
    this.baseUrl = 'https://sheets.googleapis.com/v4';
  }

  async getAuthHeader() {
    if (typeof this.auth === 'string') {
      // API Key
      return {};
    }
    // OAuth2Client
    const token = this.auth.credentials?.access_token || this.auth;
    return { Authorization: `Bearer ${token}` };
  }

  async getAuthParam() {
    if (typeof this.auth === 'string') {
      return { key: this.auth };
    }
    return {};
  }

  spreadsheets = {
    get: async (params) => {
      const authHeader = await this.getAuthHeader();
      const authParam = await this.getAuthParam();
      const response = await axios.get(
        `${this.baseUrl}/spreadsheets/${params.spreadsheetId}`,
        {
          headers: authHeader,
          params: { ...authParam, fields: params.fields }
        }
      );
      return { data: response.data };
    },

    batchUpdate: async (params) => {
      const authHeader = await this.getAuthHeader();
      const response = await axios.post(
        `${this.baseUrl}/spreadsheets/${params.spreadsheetId}:batchUpdate`,
        params.resource,
        { headers: authHeader }
      );
      return { data: response.data };
    },

    values: {
      get: async (params) => {
        const authHeader = await this.getAuthHeader();
        const authParam = await this.getAuthParam();
        const response = await axios.get(
          `${this.baseUrl}/spreadsheets/${params.spreadsheetId}/values/${params.range}`,
          {
            headers: authHeader,
            params: authParam
          }
        );
        return { data: response.data };
      },

      append: async (params) => {
        const authHeader = await this.getAuthHeader();
        const response = await axios.post(
          `${this.baseUrl}/spreadsheets/${params.spreadsheetId}/values/${params.range}:append`,
          params.resource,
          {
            headers: authHeader,
            params: {
              valueInputOption: params.valueInputOption,
              insertDataOption: params.insertDataOption
            }
          }
        );
        return { data: response.data };
      },

      update: async (params) => {
        const authHeader = await this.getAuthHeader();
        const response = await axios.put(
          `${this.baseUrl}/spreadsheets/${params.spreadsheetId}/values/${params.range}`,
          params.resource,
          {
            headers: authHeader,
            params: { valueInputOption: params.valueInputOption }
          }
        );
        return { data: response.data };
      },

      clear: async (params) => {
        const authHeader = await this.getAuthHeader();
        const response = await axios.post(
          `${this.baseUrl}/spreadsheets/${params.spreadsheetId}/values/${params.range}:clear`,
          {},
          { headers: authHeader }
        );
        return { data: response.data };
      }
    }
  };
}

/**
 * Main Google API object
 */
const google = {
  auth: new GoogleAuth(),

  sheets: (config) => new GoogleSheetsAPI(config),

  oauth2: (config) => new GoogleOAuth2API(config.auth)
};

module.exports = { google };
