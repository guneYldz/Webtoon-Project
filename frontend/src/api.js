import axios from 'axios';

// Backend'imizin adresi (FastAPI varsayılan olarak burada çalışır)
const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;