import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
});

// Interceptor para definir Content-Type apenas para JSON (não para FormData)
apiClient.interceptors.request.use(
  (config) => {
    // Se não for FormData, definir Content-Type como JSON
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    // Se for FormData, deixar o axios definir automaticamente com boundary
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptors para error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;

