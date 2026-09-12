import axios from 'axios';
import { API_BASE_URL } from '../config';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT token to every request if one is stored
axiosInstance.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// In-memory token store — set this after a successful login
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export default axiosInstance;
