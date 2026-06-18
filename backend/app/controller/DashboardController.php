<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use app\model\AlbumFavorite;
use app\model\User;
use app\model\AlbumCategory;
use app\model\AccessLog;
use app\model\DailyQuota;
use app\model\MemberLevel;
use app\service\IpRegion;
use think\facade\Db;
use think\facade\Log;
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
        $todayViews = AccessLog::where('created_at', '>=', date('Y-m-d 00:00:00'))->count();

        $recentAlbums = Album::with(['category'])
            ->order('created_at', 'desc')
            ->limit(5)
            ->select()
            ->each(function ($item) {
                $item->cover_image_url = $item->cover_image ? get_upload_url($item->cover_image) : '';
                $item->page_count = AlbumPage::where('album_id', $item->id)->count();
                $item->favorite_count = AlbumFavorite::where('album_id', $item->id)->count();
                return $item;
            });

        $recentUsers = User::order('created_at', 'desc')
            ->limit(5)
            ->field('id,username,nickname,role,status,created_at')
            ->select();

        $quotaStats = DailyQuota::levelQuotaUsageStats();
        $quotaUsage = [];
        foreach ($quotaStats as $s) {
            $quotaUsage[] = [
                'level_id'       => (int)$s['level_id'],
                'level_name'     => $s['level_name'],
                'daily_quota'    => (int)($s['daily_quota'] ?? 0),
                'user_count'     => (int)($s['user_count'] ?? 0),
                'today_reads'    => (int)($s['today_reads'] ?? 0),
                'expected_total' => (int)($s['expected_total'] ?? 0),
                'is_unlimited'   => !empty($s['is_unlimited']),
                'usage_rate'     => (float)($s['usage_rate'] ?? 0),
            ];
        }

        $totalTodayQuotaReads = array_sum(array_column($quotaUsage, 'today_reads'));

        $topFavoriteAlbums = AlbumFavorite::alias('f')
            ->join('albums a', 'f.album_id = a.id')
            ->field('a.id, a.title, a.cover_image, COUNT(f.id) as favorite_count')
            ->group('f.album_id')
            ->order('favorite_count', 'desc')
            ->limit(5)
            ->select()
            ->each(function ($item) {
                $item->cover_image_url = $item->cover_image ? get_upload_url($item->cover_image) : '';
                $item->favorite_count = (int)$item->favorite_count;
                return $item;
            });

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
            'top_favorite_albums'   => $topFavoriteAlbums,
        ]);
    }

    public function regionStats(Request $request)
    {
        $range = $request->get('range', 'today');

        if ($range === '7days') {
            $startTime = date('Y-m-d 00:00:00', strtotime('-6 days'));
        } elseif ($range === '30days') {
            $startTime = date('Y-m-d 00:00:00', strtotime('-29 days'));
        } else {
            $startTime = date('Y-m-d 00:00:00');
        }

        $total = AccessLog::where('created_at', '>=', $startTime)->count();

        $provinceStats = AccessLog::where('created_at', '>=', $startTime)
            ->group('province')
            ->field('province, COUNT(*) as count')
            ->order('count', 'desc')
            ->select()
            ->toArray();

        $unknownCount = 0;
        $knownProvinces = [];
        foreach ($provinceStats as $item) {
            $province = $item['province'];
            $count = (int)$item['count'];
            if ($province === null || $province === '' || $province === '未知') {
                $unknownCount += $count;
            } else {
                $knownProvinces[] = ['province' => $province, 'count' => $count];
            }
        }

        $top10 = array_slice($knownProvinces, 0, 10);
        $top10WithPercent = array_map(function ($item) use ($total) {
            return [
                'province' => $item['province'],
                'count'    => (int)$item['count'],
                'percent'  => $total > 0 ? round(($item['count'] / $total) * 100, 2) : 0,
            ];
        }, $top10);

        $allProvinceMap = [];
        foreach ($knownProvinces as $item) {
            $allProvinceMap[$item['province']] = (int)$item['count'];
        }

        return json_success([
            'top10'         => $top10WithPercent,
            'province_map'  => $allProvinceMap,
            'unknown_count' => $unknownCount,
            'total'         => $total,
        ]);
    }

    public function backfillRegion(Request $request)
    {
        $batchSize = 200;
        $maxBatches = 50;

        $processed = 0;
        $updated = 0;
        $failed = 0;
        $lastId = 0;

        for ($batch = 0; $batch < $maxBatches; $batch++) {
            $logs = AccessLog::where('id', '>', $lastId)
                ->where('ip', '<>', '')
                ->where(function ($query) {
                    $query->whereNull('province')
                        ->whereOr('province', '')
                        ->whereOr('province', '未知');
                })
                ->order('id', 'asc')
                ->limit($batchSize)
                ->select();

            if ($logs->isEmpty()) {
                break;
            }

            foreach ($logs as $log) {
                $lastId = $log->id;
                $processed++;

                try {
                    $region = IpRegion::resolve($log->ip);
                    $log->province = $region['province'] ?? '未知';
                    $log->city = $region['city'] ?? '未知';
                    $log->save();
                    if ($log->province !== '未知') {
                        $updated++;
                    }
                } catch (\Throwable $e) {
                    $failed++;
                    Log::warning("回填IP地域失败: id={$log->id}, ip={$log->ip}, error=" . $e->getMessage());
                }
            }

            if ($logs->count() < $batchSize) {
                break;
            }

            if ($batch > 0 && $batch % 5 === 0) {
                usleep(100000);
            }
        }

        return json_success([
            'processed' => $processed,
            'updated'   => $updated,
            'failed'    => $failed,
        ], "回填完成：处理{$processed}条，更新{$updated}条，失败{$failed}条");
    }
}
