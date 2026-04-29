<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class Controller
{
    // ─── Helper Response ──────────────────────────────────────────────────────

    protected function sukses(string $pesan, mixed $data = null, int $kode = 200): JsonResponse
    {
        $body = ['status' => 'sukses', 'pesan' => $pesan];
        if ($data !== null) {
            $body['data'] = $data;
        }
        return response()->json($body, $kode);
    }

    protected function error(string $pesan, int $kode = 400, mixed $kesalahan = null): JsonResponse
    {
        $body = ['status' => 'error', 'pesan' => $pesan];
        if ($kesalahan !== null) {
            $body['kesalahan'] = $kesalahan;
        }
        return response()->json($body, $kode);
    }

    protected function suksesDibuat(string $pesan, mixed $data = null): JsonResponse
    {
        return $this->sukses($pesan, $data, 201);
    }
}
