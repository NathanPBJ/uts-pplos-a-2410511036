<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/health',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Daftarkan alias agar bisa dipakai di routes: middleware('gateway.auth')
        $middleware->alias([
            'gateway.auth' => \App\Http\Middleware\VerifyGatewayToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Seluruh error API dikembalikan dalam format JSON Bahasa Indonesia

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            return response()->json([
                'status' => 'error',
                'pesan'  => 'Data yang diminta tidak ditemukan.',
            ], 404);
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            return response()->json([
                'status' => 'error',
                'pesan'  => 'Metode HTTP tidak diizinkan untuk endpoint ini.',
            ], 405);
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            return response()->json([
                'status'    => 'error',
                'pesan'     => 'Data yang dikirim tidak valid.',
                'kesalahan' => $e->errors(),
            ], 422);
        });

        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $kode = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
                return response()->json([
                    'status' => 'error',
                    'pesan'  => $kode === 500
                        ? 'Terjadi kesalahan server yang tidak terduga. Silakan coba lagi nanti.'
                        : $e->getMessage(),
                ], $kode);
            }
        });
    })
    ->create();
