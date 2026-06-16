<?php

namespace app\controller;

use app\model\User;
use think\facade\Db;
use think\facade\Log;
use think\Request;

class InitController
{
    public function init(Request $request)
    {
        $this->migrateDatabase();
        $this->initAdminPassword();
        $this->initLevelQuotas();
        return json_success([], '初始化完成');
    }

    private function migrateDatabase()
    {
        try {
            $columns = Db::query("SHOW COLUMNS FROM `member_levels` LIKE 'daily_quota'");
            if (empty($columns)) {
                Db::execute("ALTER TABLE `member_levels` ADD COLUMN `daily_quota` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '每日可阅读画册数，0表示不限' AFTER `description`");
                Log::info('迁移: member_levels 表新增 daily_quota 字段');
            }
        } catch (\Exception $e) {
            Log::error('迁移 member_levels 失败: ' . $e->getMessage());
        }

        try {
            $tableExists = Db::query("SHOW TABLES LIKE 'user_daily_quotas'");
            if (empty($tableExists)) {
                Db::execute("
                    CREATE TABLE IF NOT EXISTS `user_daily_quotas` (
                        `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID，0表示未登录访客',
                        `visitor_key` VARCHAR(64) DEFAULT '' COMMENT '访客唯一标识（IP+UA哈希），仅访客使用',
                        `album_id` INT UNSIGNED NOT NULL COMMENT '画册ID',
                        `read_date` DATE NOT NULL COMMENT '阅读日期',
                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE KEY `uk_user_date_album` (`user_id`, `read_date`, `album_id`),
                        UNIQUE KEY `uk_visitor_date_album` (`visitor_key`, `read_date`, `album_id`),
                        KEY `idx_user_date` (`user_id`, `read_date`),
                        KEY `idx_visitor_date` (`visitor_key`, `read_date`),
                        KEY `idx_date` (`read_date`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户日阅读配额记录表'
                ");
                Log::info('迁移: user_daily_quotas 表已创建');
            }
        } catch (\Exception $e) {
            Log::error('迁移 user_daily_quotas 失败: ' . $e->getMessage());
        }
    }

    private function initLevelQuotas()
    {
        try {
            $levelDefaults = [
                1 => 3,
                2 => 5,
                3 => 10,
                4 => 0,
            ];
            foreach ($levelDefaults as $id => $quota) {
                Db::execute("UPDATE `member_levels` SET `daily_quota` = {$quota} WHERE `id` = {$id} AND `daily_quota` IS NULL");
                Db::execute("UPDATE `member_levels` SET `daily_quota` = {$quota} WHERE `id` = {$id} AND `daily_quota` = 0 AND `level` < 3");
            }
            Db::execute("UPDATE `member_levels` SET `daily_quota` = 0 WHERE `id` = 4 AND `daily_quota` IS NULL");
        } catch (\Exception $e) {
            Log::error('初始化等级配额失败: ' . $e->getMessage());
        }
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
