<?php

namespace app\service;

use think\facade\Log;

class IpRegion
{
    private static ?IpRegionParserInterface $parser = null;

    public static function setParser(IpRegionParserInterface $parser): void
    {
        self::$parser = $parser;
    }

    public static function getParser(): IpRegionParserInterface
    {
        if (self::$parser === null) {
            self::$parser = new BuiltinIpRegionParser();
        }
        return self::$parser;
    }

    public static function resolve(string $ip): array
    {
        if (empty($ip)) {
            return ['province' => '未知', 'city' => '未知'];
        }

        try {
            $result = self::getParser()->parse($ip);
            if (!isset($result['province']) || empty($result['province'])) {
                $result['province'] = '未知';
            }
            if (!isset($result['city']) || empty($result['city'])) {
                $result['city'] = '未知';
            }
            return $result;
        } catch (\Throwable $e) {
            Log::warning("IP地域解析失败: ip={$ip}, error=" . $e->getMessage());
            return ['province' => '未知', 'city' => '未知'];
        }
    }
}
