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

    public static function consumeQuota(int $userId, int $albumId, string $visitorKey, int $dailyQuota): array
    {
        $today = date('Y-m-d');
        $isGuest = $userId <= 0;

        try {
            Db::startTrans();

            $query = Db::name('user_daily_quotas')->lock(true);
            if ($isGuest) {
                $currentCount = $query->where('visitor_key', $visitorKey)->where('read_date', $today)->count();
            } else {
                $currentCount = $query->where('user_id', $userId)->where('read_date', $today)->count();
            }

            if ($isGuest) {
                $existing = Db::name('user_daily_quotas')
                    ->where('visitor_key', $visitorKey)
                    ->where('album_id', $albumId)
                    ->where('read_date', $today)
                    ->lock(true)
                    ->find();
            } else {
                $existing = Db::name('user_daily_quotas')
                    ->where('user_id', $userId)
                    ->where('album_id', $albumId)
                    ->where('read_date', $today)
                    ->lock(true)
                    ->find();
            }

            $alreadyRead = $existing !== null;

            if (!$alreadyRead) {
                if ($dailyQuota > 0 && $currentCount >= $dailyQuota) {
                    Db::rollback();
                    return [
                        'success'       => false,
                        'exhausted'     => true,
                        'already_read'  => false,
                        'today_count'   => $currentCount,
                        'daily_quota'   => $dailyQuota,
                    ];
                }

                try {
                    Db::name('user_daily_quotas')->insert([
                        'user_id'     => $isGuest ? 0 : $userId,
                        'visitor_key' => $isGuest ? $visitorKey : '',
                        'album_id'    => $albumId,
                        'read_date'   => $today,
                        'created_at'  => date('Y-m-d H:i:s'),
                    ]);
                    $currentCount++;
                } catch (\Exception $e) {
                    if (strpos($e->getMessage(), 'Duplicate') !== false) {
                        $alreadyRead = true;
                    } else {
                        Db::rollback();
                        throw $e;
                    }
                }
            }

            Db::commit();

            return [
                'success'       => true,
                'exhausted'     => false,
                'already_read'  => $alreadyRead,
                'today_count'   => $currentCount,
                'daily_quota'   => $dailyQuota,
            ];
        } catch (\Exception $e) {
            try { Db::rollback(); } catch (\Exception $_) {}
            throw $e;
        }
    }

    public static function levelQuotaUsageStats(): array
    {
        $today = date('Y-m-d');
        $vipLevel = VIP_LEVEL_THRESHOLD;
        $sql = "
            SELECT
                ml.id AS level_id,
                ml.level,
                ml.name AS level_name,
                ml.daily_quota,
                COUNT(DISTINCT u.id) AS user_count,
                COUNT(DISTINCT CASE WHEN dq.read_date = '{$today}' THEN CONCAT(dq.user_id, '-', dq.album_id) END) AS today_reads
            FROM member_levels ml
            LEFT JOIN users u ON u.member_level_id = ml.id AND u.status = 1 AND u.role <> 'admin'
            LEFT JOIN user_daily_quotas dq ON dq.user_id = u.id
            GROUP BY ml.id, ml.level, ml.name, ml.daily_quota
            ORDER BY ml.level ASC
        ";
        $rows = Db::query($sql);
        foreach ($rows as &$r) {
            $dailyQuota = (int)($r['daily_quota'] ?? 0);
            $level = (int)($r['level'] ?? 0);
            $userCount = (int)($r['user_count'] ?? 0);
            $todayReads = (int)($r['today_reads'] ?? 0);
            $isUnlimited = $dailyQuota === 0 || $level >= $vipLevel;
            $expectedTotal = (!$isUnlimited && $userCount > 0) ? $dailyQuota * $userCount : 0;
            $r['is_unlimited'] = $isUnlimited;
            $r['expected_total'] = $expectedTotal;
            $r['usage_rate'] = $expectedTotal > 0 ? min(100, round(($todayReads / $expectedTotal) * 100, 2)) : 0;
        }
        return $rows;
    }
}
