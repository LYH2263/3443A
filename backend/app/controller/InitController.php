<?php

namespace app\controller;

use app\model\User;
use think\facade\Log;
use think\Request;

class InitController
{
    public function init(Request $request)
    {
        $this->initAdminPassword();
        return json_success([], '初始化完成');
    }

    public function initAdminPassword()
    {
        $accounts = [
            ['username' => 'admin', 'password' => '123456'],
            ['username' => 'testuser', 'password' => '123456'],
            ['username' => 'vipuser', 'password' => '123456'],
        ];

        foreach ($accounts as $account) {
            $user = User::where('username', $account['username'])->find();
            if ($user) {
                $rawPassword = $user->getData('password');
                if (str_contains($rawPassword, 'placeholder') || !password_verify($account['password'], $rawPassword)) {
                    $user->password = $account['password'];
                    $user->save();
                    Log::info("初始化用户密码: {$account['username']}");
                }
            }
        }
    }

    public function health()
    {
        try {
            \think\facade\Db::query("SELECT 1");
            return json_success([
                'status'    => 'ok',
                'timestamp' => date('Y-m-d H:i:s'),
                'database'  => 'connected',
            ]);
        } catch (\Exception $e) {
            Log::error("Health check failed: " . $e->getMessage());
            return json_error('数据库连接异常', 500);
        }
    }
}
