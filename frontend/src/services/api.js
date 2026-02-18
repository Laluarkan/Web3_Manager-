import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

// Instance Axios
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Fungsi untuk mengambil kartu user
// Nanti kita tambahkan auth token di sini
export const getMyCards = async () => {
    try {
        // Karena belum ada login user asli, kita buat endpoint dummy dulu di Django
        // atau sementara kita ambil list semua pemain untuk testing tampilan
        // Ingat endpoint 'generate-starter' yang kita buat?
        const response = await api.get('/generate-starter/'); 
        return response.data;
    } catch (error) {
        console.error("Error fetching cards:", error);
        return [];
    }
};

export default api;