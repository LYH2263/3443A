<?php

namespace app\service;

use app\model\AuditLog;
use think\facade\Log;
use think\facade\Db;

class AuditWriter
{
    private static array $queue = [];
    private static bool $registered = false;

    private static array $sensitiveFields = [
        'password',
        'share_password',
        'old_password',
        'new_password',
        'token',
        'jwt',
        'secret',
        'api_key',
    ];

    private static array $displayNameMap = [
        'username' => '用户名',
        'password' => '密码',
        'nickname' => '昵称',
        'email' => '邮箱',
        'phone' => '手机号',
        'avatar' => '头像',
        'role' => '角色',
        'member_level_id' => '会员等级',
        'status' => '状态',
        'title' => '标题',
        'description' => '描述',
        'cover_image' => '封面图',
        'background_image' => '背景图',
        'category_id' => '分类',
        'min_level' => '最低等级',
        'share_password' => '分享密码',
        'qrcode_image' => '二维码图',
        'qrcode_logo' => '二维码Logo',
        'qrcode_text_line1' => '二维码文字1',
        'qrcode_text_line2' => '二维码文字2',
        'sort_order' => '排序',
        'name' => '名称',
        'level' => '等级值',
        'daily_quota' => '每日配额',
        'view_count' => '浏览次数',
        'watermark_enabled' => '启用水印',
        'watermark_text' => '水印文字',
        'watermark_opacity' => '水印透明度',
        'watermark_density' => '水印密度',
        'watermark_color' => '水印颜色',
        'creator_id' => '创建者',
    ];

    private static function registerShutdown(): void
    {
        if (self::$registered) {
            return;
        }
        self::$registered = true;
        register_shutdown_function(function () {
            self::flush();
        });
    }

    public static function maskSensitive(array $data): array
    {
        foreach (self::$sensitiveFields as $field) {
            if (array_key_exists($field, $data) && !empty($data[$field])) {
                $data[$field] = '***';
            }
        }
        return $data;
    }

    public static function computeChanges(?array $before, ?array $after): array
    {
        $before = $before ? self::maskSensitive($before) : [];
        $after = $after ? self::maskSensitive($after) : [];

        $changes = [
            'before' => [],
            'after'  => [],
        ];

        $allKeys = array_unique(array_merge(array_keys($before), array_keys($after)));

        foreach ($allKeys as $key) {
            $valBefore = $before[$key] ?? null;
            $valAfter = $after[$key] ?? null;

            if (is_array($valBefore)) $valBefore = json_encode($valBefore, JSON_UNESCAPED_UNICODE);
            if (is_array($valAfter)) $valAfter = json_encode($valAfter, JSON_UNESCAPED_UNICODE);

            if ((string)$valBefore !== (string)$valAfter) {
                $displayName = self::$displayNameMap[$key] ?? $key;
                $changes['before'][$key] = [
                    'label' => $displayName,
                    'value' => $valBefore,
                ];
                $changes['after'][$key] = [
                    'label' => $displayName,
                    'value' => $valAfter,
                ];
            }
        }

        if (empty($changes['before']) && empty($changes['after'])) {
            return [];
        }

        return $changes;
    }

    public static function log(string $actionType, string $targetType, $targetId = '', string $targetName = '', ?array $before = null, ?array $after = null, ?int $operatorId = null, ?string $operatorName = null, ?string $operatorRole = null): void
    {
        $request = request();

        $ip = '';
        $userAgent = '';
        try {
            $ip = $request->ip();
            $userAgent = substr((string)$request->header('user-agent', ''), 0, 500);
        } catch (\Throwable $e) {}

        if ($operatorId === null) {
            try {
                $operatorId = $request->uid ?? null;
            } catch (\Throwable $e) {
                $operatorId = null;
            }
        }
        if ($operatorName === null) {
            try {
                if (!empty($request->username)) {
                    $operatorName = $request->username;
                }
            } catch (\Throwable $e) {}
        }
        if ($operatorRole === null) {
            try {
                $operatorRole = $request->role ?? null;
            } catch (\Throwable $e) {}
        }

        $changeSummary = null;
        if ($before !== null || $after !== null) {
            $computed = self::computeChanges($before, $after);
            if (!empty($computed)) {
                $changeSummary = $computed;
            }
        }

        $record = [
            'operator_id'    => $operatorId,
            'operator_name'  => $operatorName ?: '',
            'operator_role'  => $operatorRole ?: '',
            'action_type'    => $actionType,
            'target_type'    => $targetType,
            'target_id'      => (string)$targetId,
            'target_name'    => $targetName ?: '',
            'change_summary' => $changeSummary,
            'ip'             => $ip,
            'user_agent'     => $userAgent,
            'created_at'     => date('Y-m-d H:i:s'),
        ];

        self::$queue[] = $record;
        self::registerShutdown();
    }

    public static function flush(): void
    {
        if (empty(self::$queue)) {
            return;
        }

        $records = self::$queue;
        self::$queue = [];

        try {
            Db::startTrans();
            foreach ($records as $record) {
                $log = new AuditLog();
                foreach ($record as $k => $v) {
                    if ($k === 'change_summary' && is_array($v)) {
                        $log->setAttr($k, $v);
                    } else {
                        $log->setAttr($k, $v);
                    }
                }
                $log->save();
            }
            Db::commit();
        } catch (\Throwable $e) {
            try { Db::rollback(); } catch (\Throwable $_) {}
            foreach ($records as $record) {
                $summary = is_array($record['change_summary']) ? json_encode($record['change_summary'], JSON_UNESCAPED_UNICODE) : '';
                Log::warning(sprintf(
                    '[AUDIT_FALLBACK] op=%s uid=%d(%s) action=%s target=%s:%s ip=%s | %s',
                    $record['operator_role'],
                    $record['operator_id'] ?: 0,
                    $record['operator_name'],
                    $record['action_type'],
                    $record['target_type'],
                    $record['target_name'] ?: $record['target_id'],
                    $record['ip'],
                    $summary
                ));
            }
            Log::error('[AUDIT_FLUSH_FAILED] ' . $e->getMessage());
        }
    }

    public static function logCreate(string $targetType, $targetId, string $targetName, array $after): void
    {
        self::log('create', $targetType, $targetId, $targetName, null, $after);
    }

    public static function logUpdate(string $targetType, $targetId, string $targetName, ?array $before, ?array $after): void
    {
        self::log('update', $targetType, $targetId, $targetName, $before, $after);
    }

    public static function logDelete(string $targetType, $targetId, string $targetName, ?array $before = null): void
    {
        self::log('delete', $targetType, $targetId, $targetName, $before, null);
    }

    public static function logLogin($userId, string $username, string $role, ?array $extra = null): void
    {
        self::log('login', 'system', '', '用户登录', null, $extra, $userId, $username, $role);
    }

    public static function logQrcode(string $targetType, $targetId, string $targetName, ?array $extra = null): void
    {
        self::log('qrcode', $targetType, $targetId, $targetName, null, $extra);
    }
}
