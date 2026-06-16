<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use app\model\User;
use app\model\AlbumCategory;
use app\model\AccessLog;
use app\model\DailyQuota;
use app\model\MemberLevel;
use think\Request;

class DashboardController
{
    public function stats(Request $request)
    {
        $albumCount = Album::count();
        $publishedCount = Album::where('status', 1)->count();
        $pageCount = AlbumPage::count();
        $userCount = User::count();
        $categoryCount = AlbumCategory::where('status', 1)->count();
        $totalViews = Album::sum('view_count');
        $todayViews = AccessLog::whereDay('created_at')->count();

        $recentAlbums = Album::with(['category'])
            ->order('created_at', 'desc')
            ->limit(5)
            ->select()
            ->each(function ($item) {
                $item->cover_image_url = $item->cover_image ? get_upload_url($item->cover_image) : '';
                $item->page_count = AlbumPage::where('album_id', $item->id)->count();
                return $item;
            });

        $recentUsers = User::order('created_at', 'desc')
            ->limit(5)
            ->field('id,username,nickname,role,status,created_at')
            ->select();

        $quotaStats = DailyQuota::levelQuotaUsageStats();
        $quotaUsage = [];
        foreach ($quotaStats as $s) {
            $dailyQuota = (int)($s['daily_quota'] ?? 0);
            $userCountL = (int)($s['user_count'] ?? 0);
            $todayReads = (int)($s['today_reads'] ?? 0);
            $expectedTotal = $dailyQuota > 0 && $userCountL > 0 ? $dailyQuota * $userCountL : 0;
            $usageRate = $expectedTotal > 0 ? round(($todayReads / $expectedTotal) * 100, 2) : 0;
            $quotaUsage[] = [
                'level_id'     => (int)$s['level_id'],
                'level_name'   => $s['level_name'],
                'daily_quota'  => $dailyQuota,
                'user_count'   => $userCountL,
                'today_reads'  => $todayReads,
                'is_unlimited' => $dailyQuota == 0,
                'usage_rate'   => $usageRate,
            ];
        }

        $totalTodayQuotaReads = array_sum(array_column($quotaUsage, 'today_reads'));

        return json_success([
            'album_count'           => $albumCount,
            'published_count'       => $publishedCount,
            'page_count'            => $pageCount,
            'user_count'            => $userCount,
            'category_count'        => $categoryCount,
            'total_views'           => $totalViews,
            'today_views'           => $todayViews,
            'today_quota_reads'     => $totalTodayQuotaReads,
            'quota_usage'           => $quotaUsage,
            'recent_albums'         => $recentAlbums,
            'recent_users'          => $recentUsers,
        ]);
    }
}
