<?php

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use app\model\User;
use app\model\MemberLevel;
use app\model\DailyQuota;

function json_success($data = [], string $message = '操作成功', int $code = 200): \think\response\Json
{
    return json([
        'code'    => $code,
        'message' => $message,
        'data'    => $data,
    ]);
}

function json_error(string $message = '操作失败', int $code = 400, $data = []): \think\response\Json
{
    return json([
        'code'    => $code,
        'message' => $message,
        'data'    => $data,
    ]);
}

function create_token(array $payload): string
{
    $key = env('JWT_SECRET', 'flipbook_jwt_secret_key_2024');
    $payload['iat'] = time();
    $payload['exp'] = time() + 86400 * 7;
    return JWT::encode($payload, $key, 'HS256');
}

function verify_token(string $token): ?array
{
    try {
        $key = env('JWT_SECRET', 'flipbook_jwt_secret_key_2024');
        $decoded = JWT::decode($token, new Key($key, 'HS256'));
        return (array) $decoded;
    } catch (\Exception $e) {
        return null;
    }
}

function getRequestData(\think\Request $request): array
{
    $data = $request->post();
    if (empty($data)) {
        $input = $request->getContent();
        if (!empty($input)) {
            $decoded = json_decode($input, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }
    }
    return $data;
}

function get_upload_url(string $path): string
{
    if (empty($path)) {
        return '';
    }
    if (str_starts_with($path, 'http') || str_starts_with($path, '/')) {
        return $path;
    }
    return '/uploads/' . ltrim($path, '/');
}

const GUEST_DAILY_QUOTA = 1;
const VIP_LEVEL_THRESHOLD = 3;

function resolve_quota_context(\think\Request $request): array
{
    $userId = 0;
    $user = null;
    $memberLevel = null;
    $isAdmin = false;
    $isVip = false;
    $isUnlimited = false;
    $dailyQuota = 0;
    $levelName = '访客';
    $levelValue = 0;
    $token = $request->header('Authorization', '');
    if (str_starts_with($token, 'Bearer ')) {
        $token = substr($token, 7);
    }
    if (!empty($token)) {
        $payload = verify_token($token);
        if ($payload) {
            $user = User::find($payload['uid'] ?? 0);
            if ($user) {
                $memberLevel = MemberLevel::find($user->member_level_id);
                $userId = (int)$user->id;
                $levelValue = $memberLevel ? (int)$memberLevel->level : 0;
                $levelName = $memberLevel ? $memberLevel->name : '普通会员';
                $dailyQuota = $memberLevel ? (int)$memberLevel->daily_quota : 0;
                $isAdmin = $user->role === 'admin';
                $isVip = $levelValue >= VIP_LEVEL_THRESHOLD;
                $isUnlimited = $isAdmin || $isVip || $dailyQuota === 0;
            }
        }
    }

    $ip = $request->ip() ?: '';
    $userAgent = $request->header('user-agent', '') ?: '';
    $visitorKey = DailyQuota::getVisitorKey($ip, $userAgent);

    if ($userId === 0) {
        $dailyQuota = GUEST_DAILY_QUOTA;
        $isUnlimited = false;
    }

    $effectiveLevel = $isAdmin ? 999 : $levelValue;

    return [
        'user_id'       => $userId,
        'user'          => $user,
        'member_level'  => $memberLevel,
        'level_name'    => $levelName,
        'level_value'   => $levelValue,
        'effective_level' => $effectiveLevel,
        'daily_quota'   => $dailyQuota,
        'is_admin'      => $isAdmin,
        'is_vip'        => $isVip,
        'is_unlimited'  => $isUnlimited,
        'visitor_key'   => $visitorKey,
        'ip'            => $ip,
        'user_agent'    => $userAgent,
    ];
}

function get_quota_info(array $ctx): array
{
    $userId = $ctx['user_id'];
    $visitorKey = $ctx['visitor_key'];
    $todayCount = DailyQuota::countToday($userId, $userId > 0 ? '' : $visitorKey);
    $dailyQuota = (int)$ctx['daily_quota'];
    $isUnlimited = (bool)$ctx['is_unlimited'];
    $remaining = $isUnlimited ? -1 : max(0, $dailyQuota - $todayCount);
    $usageRate = ($dailyQuota > 0 && !$isUnlimited) ? min(100, round(($todayCount / $dailyQuota) * 100, 2)) : 0;
    return [
        'user_id'      => $userId,
        'level_name'   => $ctx['level_name'],
        'is_guest'     => $userId === 0,
        'is_unlimited' => $isUnlimited,
        'is_admin'     => $ctx['is_admin'],
        'is_vip'       => $ctx['is_vip'],
        'daily_quota'  => $dailyQuota,
        'today_count'  => $todayCount,
        'remaining'    => $remaining,
        'usage_rate'   => $usageRate,
    ];
}
