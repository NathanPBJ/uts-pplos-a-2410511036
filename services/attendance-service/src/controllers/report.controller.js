'use strict';

const dayjs = require('dayjs');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, HeadingLevel,
  BorderStyle, ShadingType,
} = require('docx');

const { pool } = require('../utils/db');

// ─── Helper: Query rekap ──────────────────────────────────────────────────────

async function queryRekap(bulan, tahun, employeeId = null) {
  const params = [tahun, bulan];
  let extraWhere = '';

  if (employeeId) {
    extraWhere = 'AND employee_id = ?';
    params.push(employeeId);
  }

  const [rows] = await pool.query(
    `SELECT
       employee_id,
       employee_nip,
       employee_name,
       COUNT(*)                                              AS total_hari_kerja,
       SUM(status = 'hadir')                                AS total_hadir,
       SUM(status = 'telat')                                AS total_telat,
       SUM(status = 'alpha')                                AS total_alpha,
       SUM(status = 'cuti')                                 AS total_cuti,
       SUM(status = 'libur')                                AS total_libur,
       SUM(poin_delta)                                      AS total_poin,
       ROUND(SUM(terlambat_menit) / NULLIF(SUM(status = 'telat'), 0)) AS rata_terlambat_menit
     FROM attendances
     WHERE YEAR(tanggal) = ? AND MONTH(tanggal) = ?
     ${extraWhere}
     GROUP BY employee_id, employee_nip, employee_name
     ORDER BY employee_name ASC`,
    params,
  );

  return rows;
}

// ─── Rekap Bulanan (JSON) ─────────────────────────────────────────────────────

/**
 * GET /api/laporan/bulanan?bulan=1&tahun=2024&employee_id=
 * Rekap kehadiran bulanan dalam format JSON.
 */
async function rekapBulanan(req, res) {
  const bulan      = parseInt(req.query.bulan,  10);
  const tahun      = parseInt(req.query.tahun,  10);
  const employeeId = req.query.employee_id || null;

  if (!bulan || bulan < 1 || bulan > 12) {
    return res.status(422).json({ status: 'error', pesan: 'Parameter bulan tidak valid (1–12).' });
  }
  if (!tahun || tahun < 2020 || tahun > 2100) {
    return res.status(422).json({ status: 'error', pesan: 'Parameter tahun tidak valid.' });
  }

  const rows = await queryRekap(bulan, tahun, employeeId);

  const namaBulan = dayjs(`${tahun}-${String(bulan).padStart(2, '0')}-01`).format('MMMM YYYY');

  const ringkasan = rows.reduce(
    (acc, r) => ({
      total_pegawai:    acc.total_pegawai + 1,
      total_hadir:      acc.total_hadir  + (r.total_hadir  || 0),
      total_telat:      acc.total_telat  + (r.total_telat  || 0),
      total_alpha:      acc.total_alpha  + (r.total_alpha  || 0),
      total_cuti:       acc.total_cuti   + (r.total_cuti   || 0),
      total_poin:       acc.total_poin   + (r.total_poin   || 0),
    }),
    { total_pegawai: 0, total_hadir: 0, total_telat: 0, total_alpha: 0, total_cuti: 0, total_poin: 0 },
  );

  return res.status(200).json({
    status: 'sukses',
    pesan:  `Rekap kehadiran ${namaBulan} berhasil dimuat.`,
    data: {
      periode:   { bulan, tahun, label: namaBulan },
      ringkasan,
      pegawai:   rows.map((r) => ({
        id:                   r.employee_id,
        nip:                  r.employee_nip,
        nama:                 r.employee_name,
        total_hari_kerja:     r.total_hari_kerja,
        hadir:                r.total_hadir      || 0,
        telat:                r.total_telat      || 0,
        alpha:                r.total_alpha      || 0,
        cuti:                 r.total_cuti       || 0,
        libur:                r.total_libur      || 0,
        poin_kehadiran:       r.total_poin       || 0,
        rata_terlambat_menit: r.rata_terlambat_menit || 0,
      })),
    },
  });
}

// ─── Export DOCX ─────────────────────────────────────────────────────────────

/**
 * GET /api/laporan/bulanan/export?bulan=1&tahun=2024
 * Menghasilkan file .docx rekap kehadiran bulanan untuk diunduh.
 */
async function exportDocx(req, res) {
  const bulan = parseInt(req.query.bulan, 10);
  const tahun = parseInt(req.query.tahun, 10);

  if (!bulan || bulan < 1 || bulan > 12) {
    return res.status(422).json({ status: 'error', pesan: 'Parameter bulan tidak valid (1–12).' });
  }
  if (!tahun || tahun < 2020 || tahun > 2100) {
    return res.status(422).json({ status: 'error', pesan: 'Parameter tahun tidak valid.' });
  }

  const rows     = await queryRekap(bulan, tahun);
  const namaBulan = dayjs(`${tahun}-${String(bulan).padStart(2, '0')}-01`).format('MMMM YYYY');
  const dicetak  = dayjs().format('DD MMMM YYYY HH:mm [WIB]');

  // ── Bangun tabel ──────────────────────────────────────────────────────────

  const borderCell = {
    top:    { style: BorderStyle.SINGLE, size: 1 },
    bottom: { style: BorderStyle.SINGLE, size: 1 },
    left:   { style: BorderStyle.SINGLE, size: 1 },
    right:  { style: BorderStyle.SINGLE, size: 1 },
  };

  function buatSelHeader(teks) {
    return new TableCell({
      borders: borderCell,
      shading: { type: ShadingType.SOLID, color: '2D6A4F' },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children:  [new TextRun({ text: teks, bold: true, color: 'FFFFFF', size: 18 })],
      })],
    });
  }

  function buatSel(teks, rata = AlignmentType.CENTER) {
    return new TableCell({
      borders: borderCell,
      children: [new Paragraph({
        alignment: rata,
        children:  [new TextRun({ text: String(teks ?? '-'), size: 18 })],
      })],
    });
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      buatSelHeader('No'),
      buatSelHeader('NIP'),
      buatSelHeader('Nama Pegawai'),
      buatSelHeader('Hadir'),
      buatSelHeader('Telat'),
      buatSelHeader('Alpha'),
      buatSelHeader('Cuti'),
      buatSelHeader('Poin'),
    ],
  });

  const dataRows = rows.map((r, idx) =>
    new TableRow({
      children: [
        buatSel(idx + 1),
        buatSel(r.employee_nip),
        buatSel(r.employee_name, AlignmentType.LEFT),
        buatSel(r.total_hadir  || 0),
        buatSel(r.total_telat  || 0),
        buatSel(r.total_alpha  || 0),
        buatSel(r.total_cuti   || 0),
        buatSel(r.total_poin   || 0),
      ],
    }),
  );

  const tabel = new Table({
    width:    { size: 100, type: WidthType.PERCENTAGE },
    rows:     [headerRow, ...dataRows],
  });

  // ── Bangun dokumen ─────────────────────────────────────────────────────────

  const doc = new Document({
    creator:  'Yayasan Satwa Lestari',
    title:    `Rekap Kehadiran ${namaBulan}`,
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [new TextRun({ text: 'YAYASAN SATWA LESTARI', bold: true, size: 28 })],
        }),
        new Paragraph({
          heading:   HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          children:  [new TextRun({ text: 'REKAP KEHADIRAN PEGAWAI BULANAN', size: 24 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [new TextRun({ text: `Periode: ${namaBulan}`, size: 22, italics: true })],
        }),
        new Paragraph({ children: [new TextRun('')] }), // spasi
        tabel,
        new Paragraph({ children: [new TextRun('')] }), // spasi
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children:  [new TextRun({ text: `Dicetak pada: ${dicetak}`, size: 18, italics: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children:  [new TextRun({ text: 'Sistem Kepegawaian & Absensi — Yayasan Satwa Lestari', size: 18 })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const namaFile = `rekap-kehadiran-${tahun}-${String(bulan).padStart(2, '0')}.docx`;

  res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Length', buffer.length);

  return res.send(buffer);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { rekapBulanan, exportDocx };
