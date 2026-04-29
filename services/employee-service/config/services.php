<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Inter-Service URLs
    |--------------------------------------------------------------------------
    | URL internal masing-masing microservice. Di Docker gunakan nama container;
    | di lokal gunakan localhost dengan port yang sesuai.
    */

    'auth_service' => [
        'url'    => env('AUTH_SERVICE_URL', 'http://auth-service:3001'),
        'secret' => env('INTERNAL_SERVICE_SECRET', ''),
    ],

    'attendance_service' => [
        'url'    => env('ATTENDANCE_SERVICE_URL', 'http://attendance-service:3003'),
        'secret' => env('INTERNAL_SERVICE_SECRET', ''),
    ],

];
