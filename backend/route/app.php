<?php

use think\facade\Route;

// CORS preflight
Route::options('api/:any', function () {
    return response('', 204);
})->pattern(['any' => '.*']);

// Health check
Route::get('api/health', 'app\controller\InitController@health');

// Init (auto-called on startup, also callable manually)
Route::get('api/init', 'app\controller\InitController@init');

// Auth routes (public)
Route::group('api/auth', function () {
    Route::post('login', 'AuthController@login');
    Route::post('register', 'AuthController@register');
})->prefix('app\\controller\\')->middleware(\app\middleware\CorsMiddleware::class);

// Auth routes (require login)
Route::group('api/auth', function () {
    Route::get('profile', 'AuthController@profile');
    Route::put('profile', 'AuthController@updateProfile');
    Route::put('password', 'AuthController@changePassword');
})->prefix('app\\controller\\')->middleware([\app\middleware\CorsMiddleware::class, \app\middleware\AuthMiddleware::class]);

// Public routes (no auth required, but auth optional for level check)
Route::group('api/public', function () {
    Route::get('albums/:id', 'AlbumController@publicDetail')->pattern(['id' => '\d+']);
    Route::post('albums/:id/verify', 'AlbumController@publicDetail');
    Route::get('albums', 'AlbumController@publicList');
    Route::get('categories', 'AlbumController@categories');
})->prefix('app\\controller\\')->middleware(\app\middleware\CorsMiddleware::class);

// Upload routes (require login)
Route::group('api/upload', function () {
    Route::post('image', 'UploadController@image');
    Route::post('avatar', 'UploadController@avatar');
    Route::post('multi', 'UploadController@multiImage');
})->prefix('app\\controller\\')->middleware([\app\middleware\CorsMiddleware::class, \app\middleware\AuthMiddleware::class]);

// Admin routes (require admin)
Route::group('api/admin', function () {
    // Dashboard
    Route::get('dashboard', 'DashboardController@stats');

    // Albums CRUD
    Route::get('albums/:id', 'AlbumController@detail')->pattern(['id' => '\d+']);
    Route::get('albums', 'AlbumController@index');
    Route::post('albums', 'AlbumController@store');
    Route::put('albums/:id', 'AlbumController@update');
    Route::delete('albums/:id', 'AlbumController@delete');

    // Album Pages
    Route::get('albums/:albumId/pages', 'AlbumPageController@index');
    Route::post('albums/:albumId/pages', 'AlbumPageController@store');
    Route::put('albums/:albumId/pages/:id', 'AlbumPageController@update');
    Route::delete('albums/:albumId/pages/:id', 'AlbumPageController@delete');
    Route::post('albums/:albumId/pages/sort', 'AlbumPageController@sort');

    // QR Code
    Route::post('qrcode/generate', 'QrcodeController@generate');

    // Users
    Route::get('users/:id', 'UserController@detail')->pattern(['id' => '\d+']);
    Route::get('users', 'UserController@index');
    Route::post('users', 'UserController@store');
    Route::put('users/:id', 'UserController@update');
    Route::delete('users/:id', 'UserController@delete');

    // Member Levels
    Route::post('levels', 'MemberLevelController@store');
    Route::get('levels', 'MemberLevelController@index');
    Route::put('levels/:id', 'MemberLevelController@update');
    Route::delete('levels/:id', 'MemberLevelController@delete');

    // Categories
    Route::post('categories', 'CategoryController@store');
    Route::get('categories', 'CategoryController@index');
    Route::put('categories/:id', 'CategoryController@update');
    Route::delete('categories/:id', 'CategoryController@delete');

    // Background Images
    Route::post('backgrounds', 'BackgroundImageController@store');
    Route::get('backgrounds', 'BackgroundImageController@index');
    Route::delete('backgrounds/:id', 'BackgroundImageController@delete');
})->prefix('app\\controller\\')->middleware([\app\middleware\CorsMiddleware::class, \app\middleware\AdminMiddleware::class]);
