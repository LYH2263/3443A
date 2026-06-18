<?php

namespace app\controller;

use app\model\PageViewStat;
use app\model\Album;
use app\model\AlbumPage;
use think\facade\Log;
use think\Request;

class PageViewController
{
    public function report(Request $request)
    {
        $albumId = 0;
        $pageData = [];
        $sessionId = '';

        $contentType = $request->header('content-type', '');
        if (stripos($contentType, 'application/json') !== false) {
            $raw = file_get_contents('php://input');
            if ($raw) {
                $json = json_decode($raw, true);
                if (is_array($json)) {
                    $albumId = (int)($json['album_id'] ?? 0);
                    $pageData = $json['page_data'] ?? [];
                    $sessionId = $json['session_id'] ?? '';
                }
            }
        }

        if ($albumId <= 0) {
            $albumId = (int)$request->post('album_id', 0);
        }
        if (empty($pageData)) {
            $pageData = $request->post('page_data', []);
        }
        if ($sessionId === '') {
            $sessionId = $request->post('session_id', '');
        }

        if ($albumId <= 0 || empty($pageData)) {
            return json_error('参数错误');
        }

        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        try {
            $normalizedData = $this->normalizePageData($pageData);
            PageViewStat::batchRecord($albumId, $normalizedData);

            Log::info("页面浏览统计上报: album_id={$albumId}, pages=" . count($normalizedData) . ", session={$sessionId}");

            return json_success([
                'recorded_count' => count($normalizedData),
            ], '上报成功');
        } catch (\Exception $e) {
            Log::error("页面浏览统计上报失败: album_id={$albumId}, error=" . $e->getMessage());
            return json_error('上报失败');
        }
    }

    private function normalizePageData(array $pageData): array
    {
        $merged = [];

        foreach ($pageData as $item) {
            $pageNumber = (int)($item['page_number'] ?? 0);
            $durationMs = (int)($item['duration_ms'] ?? 0);
            $entryCount = (int)($item['entry_count'] ?? 1);

            if ($pageNumber <= 0 || $durationMs <= 0) {
                continue;
            }

            $durationSeconds = (int)ceil($durationMs / 1000);

            if ($durationSeconds < 1) {
                continue;
            }

            if (isset($merged[$pageNumber])) {
                $merged[$pageNumber]['duration_seconds'] += $durationSeconds;
                $merged[$pageNumber]['entry_count'] += $entryCount;
            } else {
                $merged[$pageNumber] = [
                    'page_number' => $pageNumber,
                    'duration_seconds' => $durationSeconds,
                    'entry_count' => $entryCount,
                ];
            }
        }

        return array_values($merged);
    }

    public function getStats(Request $request, $albumId)
    {
        $albumId = (int)$albumId;
        if ($albumId <= 0) {
            return json_error('参数错误');
        }

        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $totalPages = AlbumPage::where('album_id', $albumId)->count();

        $result = PageViewStat::getStatsWithHeatLevel($albumId, $totalPages);

        return json_success(array_merge($result, [
            'album_id' => $albumId,
            'album_title' => $album->title,
            'total_pages' => $totalPages,
            'heat_algorithm' => 'quartile',
            'heat_algorithm_note' => '采用四分位数算法：将所有非零平均停留时长分为4个区间，分别对应冷(灰)、低(绿)、中(黄)、高(橙)、热(红)五个等级',
        ]));
    }
}
