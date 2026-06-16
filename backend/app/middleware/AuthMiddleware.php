<?php

namespace app\middleware;

use think\Request;
use think\Response;

class AuthMiddleware
{
    public function handle(Request $request, \Closure $next): Response
    {
        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }

        if (empty($token)) {
            return json([
                'code'    => 401,
                'message' => '请先登录',
                'data'    => [],
            ], 401);
        }

        $payload = verify_token($token);
        if (!$payload) {
            return json([
                'code'    => 401,
                'message' => '登录已过期，请重新登录',
                'data'    => [],
            ], 401);
        }

        $request->uid = $payload['uid'] ?? 0;
        $request->role = $payload['role'] ?? 'user';
        $request->username = $payload['username'] ?? '';

        return $next($request);
    }
}
