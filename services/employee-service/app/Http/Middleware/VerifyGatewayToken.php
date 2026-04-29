<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifikasi bahwa request berasal dari API Gateway yang sudah memvalidasi JWT.
 *
 * Gateway meneruskan informasi user via headers setelah validasi JWT:
 *   X-User-Id    → ID pengguna
 *   X-User-Email → Email pengguna
 *   X-User-Role  → Peran (admin | staff | viewer)
 *   X-User-Name  → Nama lengkap pengguna
 */
class VerifyGatewayToken
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $userId = $request->header('X-User-Id');
        $role   = $request->header('X-User-Role');

        if (empty($userId) || empty($role)) {
            return response()->json([
                'status' => 'error',
                'pesan'  => 'Akses ditolak. Autentikasi diperlukan.',
            ], 401);
        }

        // Cek role jika middleware dipanggil dengan argumen, contoh: gateway.auth:admin
        if (!empty($roles) && !in_array($role, $roles, true)) {
            return response()->json([
                'status' => 'error',
                'pesan'  => 'Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini.',
            ], 403);
        }

        // Pasang data user ke request agar bisa diakses di controller
        $request->merge([
            'auth_user' => [
                'id'    => $userId,
                'email' => $request->header('X-User-Email'),
                'role'  => $role,
                'name'  => $request->header('X-User-Name'),
            ],
        ]);

        return $next($request);
    }
}
