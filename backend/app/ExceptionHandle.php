<?php

namespace app;

use think\db\exception\DataNotFoundException;
use think\db\exception\ModelNotFoundException;
use think\exception\Handle;
use think\exception\HttpException;
use think\exception\HttpResponseException;
use think\exception\ValidateException;
use think\Response;
use Throwable;

class ExceptionHandle extends Handle
{
    protected $ignoreReport = [
        HttpException::class,
        HttpResponseException::class,
        ModelNotFoundException::class,
        DataNotFoundException::class,
        ValidateException::class,
    ];

    public function report(Throwable $exception): void
    {
        parent::report($exception);
    }

    public function render($request, Throwable $e): Response
    {
        if ($e instanceof ValidateException) {
            return json([
                'code'    => 422,
                'message' => $e->getError(),
                'data'    => [],
            ]);
        }

        if ($e instanceof HttpException) {
            $statusCode = $e->getStatusCode();
            $message = $this->getHttpMessage($statusCode);
            return json([
                'code'    => $statusCode,
                'message' => $message,
                'data'    => [],
            ], $statusCode);
        }

        if ($e instanceof ModelNotFoundException || $e instanceof DataNotFoundException) {
            return json([
                'code'    => 404,
                'message' => '数据不存在',
                'data'    => [],
            ], 404);
        }

        if ($e instanceof \PDOException) {
            $errorCode = $e->getCode();
            if ($errorCode == 23000) {
                return json([
                    'code'    => 400,
                    'message' => '数据存在关联，无法执行此操作',
                    'data'    => [],
                ]);
            }
            \think\facade\Log::error('Database Error: ' . $e->getMessage());
            return json([
                'code'    => 500,
                'message' => '数据库操作异常，请稍后重试',
                'data'    => [],
            ]);
        }

        \think\facade\Log::error('System Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());

        return json([
            'code'    => 500,
            'message' => '服务器内部错误，请稍后重试',
            'data'    => [],
        ]);
    }

    private function getHttpMessage(int $code): string
    {
        $messages = [
            400 => '请求参数错误',
            401 => '未授权，请先登录',
            403 => '没有权限执行此操作',
            404 => '请求的资源不存在',
            405 => '不支持的请求方法',
            500 => '服务器内部错误',
        ];
        return $messages[$code] ?? '未知错误';
    }
}
