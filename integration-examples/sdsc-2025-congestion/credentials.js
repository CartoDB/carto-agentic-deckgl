// CARTO credentials
export const cartoCredentials = {
  accessToken: '***REMOVED***',
  apiBaseUrl: 'https://gcp-us-east1.api.carto.com'
};

// For development use local endpoint via vite proxy (see vite.config.js)
const useLocalCache = location.host.includes('127.0.0.1');
if (useLocalCache) {
  cartoCredentials.apiBaseUrl = `${location.protocol}//${location.host}/carto-api`;
}