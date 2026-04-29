<?php

namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Firebase\JWT\BeforeValidException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $authHeader = $request->header('Authorization', '');

        if (!str_starts_with($authHeader, 'Bearer ')) {
            return $this->tolak(401, 'Akses ditolak. Token autentikasi tidak ditemukan.');
        }

        $token  = substr($authHeader, 7);
        $secret = config('services.jwt.access_secret');

        try {
            $payload = JWT::decode($token, new Key($secret, 'HS256'));
        } catch (ExpiredException) {
            return $this->tolak(401, 'Sesi Anda telah berakhir. Silakan login kembali.');
        } catch (SignatureInvalidException) {
            return $this->tolak(401, 'Token tidak valid atau telah dimanipulasi.');
        } catch (BeforeValidException) {
            return $this->tolak(401, 'Token belum aktif. Silakan coba beberapa saat lagi.');
        } catch (\Throwable) {
            return $this->tolak(401, 'Token tidak dapat diproses. Silakan login kembali.');
        }

        // Pastikan ini access token, bukan refresh token
        if (($payload->type ?? '') !== 'access') {
            return $this->tolak(401, 'Tipe token tidak valid.');
        }

        // Validasi issuer & audience
        $issuer   = config('services.jwt.issuer',   'yayasan-satwa-lestari');
        $audience = config('services.jwt.audience',  'ys-lestari-clients');

        if (($payload->iss ?? '') !== $issuer || ($payload->aud ?? '') !== $audience) {
            return $this->tolak(401, 'Token tidak dikenali oleh sistem ini.');
        }

        // Cek role jika diperlukan — contoh: middleware('jwt.auth:admin')
        $role = $payload->role ?? '';
        if (!empty($roles) && !in_array($role, $roles, true)) {
            return $this->tolak(403, 'Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini.');
        }

        // Pasang data user ke request
        $request->merge([
            'auth_user' => [
                'id'    => $payload->sub,
                'email' => $payload->email ?? null,
                'role'  => $role,
                'name'  => $payload->name  ?? null,
                'jti'   => $payload->jti   ?? null,
            ],
        ]);

        return $next($request);
    }

    private function tolak(int $kode, string $pesan): Response
    {
        return response()->json(['status' => 'error', 'pesan' => $pesan], $kode);
    }
}
