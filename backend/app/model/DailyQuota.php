<?php

namespace app\model;

use think\Model;
use think\facade\Db;

class DailyQuota extends Model
{
    protected $table = 'user_daily_quotas';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = false;

    protected $type = [
        'id'        => 'integer',
        'user_id'   => 'integer',
        'album_id'  => 'integer',
    ];

    public static function getVisitorKey(string $ip, string $userAgent): string
    {
        return hash('sha256', $ip . '|' . $userAgent);
    }

    public static function countToday(int $userId, string $visitorKey = ''): int
    {
        $today = date('Y-m-d');
        if ($userId > 0) {
            return self::where('user_id', $userId)
                ->where('read_date', $today)
                ->count();
        }
        if (!empty($visitorKey)) {
            return self::where('visitor_key', $visitorKey)
                ->where('read_date', $today)
                ->count();
        }
        return 0;
    }

    public static function isAlbumReadToday(int $userId, int $albumId, string $visitorKey = ''): bool
    {
        $today = date('Y-m-d');
        if ($userId > 0) {
            return self::where('user_id', $userId)
                ->where('album_id', $albumId)
                ->where('read_date', $today)
                ->find() !== null;
        }
        if (!empty($visitorKey)) {
            return self::where('visitor_key', $visitorKey)
                ->where('album_id', $albumId)
                ->where('read_date', $today)
                ->find() !== null;
        }
        return false;
    }

    public static function recordRead(int $userId, int $albumId, string $visitorKey = ''): bool
    {
        $today = date('Y-m-d');
        try {
            $data = [
                'user_id'     => $userId > 0 ? $userId : 0,
                'visitor_key' => $userId > 0 ? '' : $visitorKey,
                'album_id'    => $albumId,
                'read_date'   => $today,
                'created_at'  => date('Y-m-d H:i:s'),
            ];
            Db::name('user_daily_quotas')->insert($data);
            return true;
        } catch (\Exception $e) {
            if (strpos($e->getMessage(), 'Duplicate') !== false) {
                return true;
            }
            throw $e;
        }
    }

    public static function levelQuotaUsageStats(): array
    {
        $today = date('Y-m-d');
        $sql = "
            SELECT
                ml.id AS level_id,
                ml.name AS level_name,
                ml.daily_quota,
                COUNT(DISTINCT u.id) AS user_count,
                COUNT(DISTINCT CASE WHEN dq.read_date = '{$today}' THEN CONCAT(dq.user_id, '-', dq.album_id) END) AS today_reads
            FROM member_levels ml
            LEFT JOIN users u ON u.member_level_id = ml.id AND u.status = 1
            LEFT JOIN user_daily_quotas dq ON dq.user_id = u.id
            GROUP BY ml.id, ml.name, ml.daily_quota
            ORDER BY ml.level ASC
        ";
        return Db::query($sql);
    }
}
