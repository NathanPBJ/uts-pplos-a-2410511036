'use strict';

const axios = require('axios');

const BASE_URL = process.env.EMPLOYEE_SERVICE_URL || 'http://employee-service:8080';
const SECRET   = process.env.INTERNAL_SERVICE_SECRET || '';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type':      'application/json',
    'X-Internal-Secret': SECRET,
  },
});

/**
 * Ambil data pegawai dari employee-service.
 * @param {number} employeeId
 * @returns {Promise<object>} data pegawai (id, nip, nama, status, poin_kehadiran, ...)
 * @throws Error jika pegawai tidak ditemukan atau tidak aktif
 */
async function getPegawai(employeeId) {
  try {
    const { data } = await client.get(`/api/internal/pegawai/${employeeId}`);
    return data.data; // { id, nip, nama, email, status, poin_kehadiran, departemen, jabatan }
  } catch (err) {
    const status = err.response?.status;
    const pesan  = err.response?.data?.pesan || err.message;

    if (status === 404) {
      const error = new Error(`Pegawai dengan ID ${employeeId} tidak ditemukan.`);
      error.status = 404;
      throw error;
    }
    if (status === 403) {
      const error = new Error(pesan);
      error.status = 403;
      throw error;
    }

    const error = new Error(`Gagal menghubungi employee-service: ${pesan}`);
    error.status = 503;
    throw error;
  }
}

/**
 * Perbarui poin kehadiran pegawai di employee-service.
 * Dipanggil setiap kali absensi dicatat atau diperbarui.
 * @param {number} employeeId
 * @param {number} delta  mis. +10, -5, -20
 * @returns {Promise<object>} { poin_sebelumnya, delta, poin_sekarang }
 */
async function updatePoinPegawai(employeeId, delta) {
  try {
    const { data } = await client.patch(`/api/internal/pegawai/${employeeId}/poin`, { delta });
    return data.data;
  } catch (err) {
    const pesan = err.response?.data?.pesan || err.message;
    // Gagal update poin tidak boleh membatalkan pencatatan absensi —
    // cukup log, jangan lempar ke caller (dipanggil fire-and-forget atau try-catch di controller)
    console.error(`[attendance-service] Gagal memperbarui poin pegawai ${employeeId}: ${pesan}`);
    throw err;
  }
}

module.exports = { getPegawai, updatePoinPegawai };
