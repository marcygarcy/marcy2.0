import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 300000, // 5 minutos para uploads grandes
});

// Interceptor para definir Content-Type apenas para JSON (não para FormData)
apiClient.interceptors.request.use(
  (config) => {
    // Se não for FormData, definir Content-Type como JSON
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    } else {
      console.log('[API_CLIENT] FormData detectado, deixando axios definir Content-Type com boundary');
      // Remover Content-Type se foi definido manualmente (axios vai adicionar com boundary)
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    console.error('[API_CLIENT] Erro no request interceptor:', error);
    return Promise.reject(error);
  }
);

// Interceptors para error handling (sem log em produção para reduzir ruído)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (process.env.NODE_ENV === 'development' && error?.response?.status >= 400) {
      console.warn('[API]', error?.config?.method, error?.config?.url, '->', error?.response?.status, error?.response?.statusText);
    }
    return Promise.reject(error);
  }
);

export default apiClient;

