<?php

namespace app\model;

use think\Model;
use think\facade\Db;

class PageViewStat extends Model
{
    protected $table = 'page_view_stats';
    protected $pk = 'id';
    protected $autoWriteTimestamp = true;
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $type = [
        'id'            => 'integer',
        'album_id'      => 'integer',
        'page_number'   => 'integer',
        'total_seconds' => 'integer',
        'entry_count'   => 'integer',
    ];

    public static function batchRecord(int $albumId, array $pageData): void
    {
        if (empty($pageData)) {
            return;
        }

        foreach ($pageData as $item) {
            $pageNumber = (int)($item['page_number'] ?? 0);
            $seconds = (int)($item['duration_seconds'] ?? 0);
            $entries = (int)($item['entry_count'] ?? 1);

            if ($pageNumber <= 0 || $seconds <= 0) {
                continue;
            }

            Db::execute("
                INSERT INTO page_view_stats (album_id, page_number, total_seconds, entry_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    total_seconds = total_seconds + VALUES(total_seconds),
                    entry_count = entry_count + VALUES(entry_count),
                    updated_at = NOW()
            ", [$albumId, $pageNumber, $seconds, $entries]);
        }
    }

    public static function getStatsByAlbum(int $albumId): array
    {
        $stats = self::where('album_id', $albumId)
            ->order('page_number', 'asc')
            ->select()
            ->toArray();

        $result = [];
        foreach ($stats as $row) {
            $totalSeconds = (int)($row['total_seconds'] ?? 0);
            $entryCount = (int)($row['entry_count'] ?? 0);
            $result[(int)$row['page_number']] = [
                'page_number' => (int)$row['page_number'],
                'total_seconds' => $totalSeconds,
                'entry_count' => $entryCount,
                'avg_seconds' => $entryCount > 0 ? round($totalSeconds / $entryCount, 2) : 0,
            ];
        }

        return $result;
    }

    public static function getStatsWithHeatLevel(int $albumId, int $totalPages = 0): array
    {
        $stats = self::getStatsByAlbum($albumId);

        if (empty($stats)) {
            return [
                'stats' => [],
                'heat_levels' => [],
                'avg_total_seconds' => 0,
                'min_seconds_page' => null,
                'max_seconds_page' => null,
                'bounce_page' => null,
            ];
        }

        $allStats = [];
        for ($i = 1; $i <= max($totalPages, max(array_keys($stats))); $i++) {
            if (isset($stats[$i])) {
                $allStats[] = $stats[$i];
            } else {
                $allStats[] = [
                    'page_number' => $i,
                    'total_seconds' => 0,
                    'entry_count' => 0,
                    'avg_seconds' => 0,
                ];
            }
        }

        $avgSecondsList = array_column($allStats, 'avg_seconds');
        $totalSecondsList = array_column($allStats, 'total_seconds');

        $avgTotalSeconds = !empty($totalSecondsList) ? round(array_sum($totalSecondsList) / count($totalSecondsList), 2) : 0;

        $minSecondsPage = null;
        $maxSecondsPage = null;
        $bouncePage = null;

        $readStats = array_filter($allStats, fn($s) => $s['entry_count'] > 0 && $s['avg_seconds'] > 0);
        if (!empty($readStats)) {
            usort($readStats, fn($a, $b) => $a['avg_seconds'] <=> $b['avg_seconds']);
            $minSecondsPage = reset($readStats);
            $maxSecondsPage = end($readStats);
            $bouncePage = $minSecondsPage;
        }

        $heatLevels = self::calculateHeatLevels($avgSecondsList);

        $statsWithHeat = array_map(function ($stat, $level) {
            $stat['heat_level'] = $level;
            $stat['heat_color'] = self::getHeatColor($level);
            return $stat;
        }, $allStats, $heatLevels);

        return [
            'stats' => $statsWithHeat,
            'heat_levels' => $heatLevels,
            'avg_total_seconds' => $avgTotalSeconds,
            'min_seconds_page' => $minSecondsPage,
            'max_seconds_page' => $maxSecondsPage,
            'bounce_page' => $bouncePage,
        ];
    }

    private static function calculateHeatLevels(array $values): array
    {
        $nonZeroValues = array_filter($values, fn($v) => $v > 0);
        if (empty($nonZeroValues)) {
            return array_fill(0, count($values), 0);
        }

        sort($nonZeroValues);
        $count = count($nonZeroValues);

        $q1 = $nonZeroValues[(int)floor($count * 0.25)] ?? 0;
        $q2 = $nonZeroValues[(int)floor($count * 0.5)] ?? 0;
        $q3 = $nonZeroValues[(int)floor($count * 0.75)] ?? 0;

        $levels = [];
        foreach ($values as $v) {
            if ($v <= 0) {
                $levels[] = 0;
            } elseif ($v < $q1) {
                $levels[] = 1;
            } elseif ($v < $q2) {
                $levels[] = 2;
            } elseif ($v < $q3) {
                $levels[] = 3;
            } else {
                $levels[] = 4;
            }
        }

        return $levels;
    }

    private static function getHeatColor(int $level): string
    {
        $colors = [
            0 => 'rgba(229, 231, 235, 0.6)',
            1 => 'rgba(34, 197, 94, 0.7)',
            2 => 'rgba(234, 179, 8, 0.7)',
            3 => 'rgba(249, 115, 22, 0.75)',
            4 => 'rgba(239, 68, 68, 0.8)',
        ];
        return $colors[$level] ?? $colors[0];
    }
}
