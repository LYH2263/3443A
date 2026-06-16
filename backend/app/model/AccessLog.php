<?php

namespace app\model;

use think\Model;

class AccessLog extends Model
{
    protected $table = 'access_logs';
    protected $pk = 'id';
    protected $autoWriteTimestamp = false;

    protected $type = [
        'id'       => 'integer',
        'album_id' => 'integer',
        'user_id'  => 'integer',
    ];

    public static function addLog(int $albumId, ?int $userId, string $ip, string $userAgent): void
    {
        $region = \app\service\IpRegion::resolve($ip);
        self::create([
            'album_id'   => $albumId,
            'user_id'    => $userId > 0 ? $userId : null,
            'ip'         => $ip,
            'province'   => $region['province'] ?? '未知',
            'city'       => $region['city'] ?? '未知',
            'user_agent' => $userAgent,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
