<?php

namespace app\service;

use app\model\Album;
use app\model\AlbumPage;
use app\model\AlbumSnapshot;
use app\model\User;
use think\facade\Db;
use think\facade\Log;

class AlbumSnapshotService
{
    private static $tableChecked = false;

    public static function ensureTableExists()
    {
        if (self::$tableChecked) {
            return;
        }
        try {
            $exists = Db::query("SHOW TABLES LIKE 'album_snapshots'");
            if (empty($exists)) {
                Db::execute("
                    CREATE TABLE IF NOT EXISTS `album_snapshots` (
                        `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        `album_id` INT UNSIGNED NOT NULL COMMENT '画册ID',
                        `version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '版本号，递增',
                        `snapshot_data` JSON NOT NULL COMMENT '快照数据（画册信息+页面列表）',
                        `page_count` INT UNSIGNED DEFAULT 0 COMMENT '快照时的页面数',
                        `size_bytes` INT UNSIGNED DEFAULT 0 COMMENT '快照数据大小(字节)',
                        `operator_id` INT UNSIGNED DEFAULT NULL COMMENT '操作人ID',
                        `remark` VARCHAR(200) DEFAULT '' COMMENT '快照备注',
                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY `uk_album_version` (`album_id`, `version`),
                        KEY `idx_album_id` (`album_id`),
                        KEY `idx_created_at` (`created_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画册快照表（版本历史）'
                ");
                Log::info('自动创建 album_snapshots 表');
            }
            self::$tableChecked = true;
        } catch (\Exception $e) {
            Log::error('确保 album_snapshots 表存在失败: ' . $e->getMessage());
        }
    }

    public static function createSnapshot($albumId, $operatorId, $remark = '', $sourceAlbum = null, $sourcePages = null)
    {
        self::ensureTableExists();

        if ($sourceAlbum === null) {
            $sourceAlbum = Album::find($albumId);
            if (!$sourceAlbum) {
                throw new \Exception('画册不存在');
            }
        }
        if ($sourcePages === null) {
            $sourcePages = AlbumPage::where('album_id', $albumId)
                ->order('page_number', 'asc')
                ->select();
        }

        $snapshotData = AlbumSnapshot::buildSnapshotData($sourceAlbum, $sourcePages);
        $jsonData = json_encode($snapshotData, JSON_UNESCAPED_UNICODE);
        $sizeBytes = strlen($jsonData);

        $maxSize = AlbumSnapshot::MAX_SNAPSHOT_SIZE_KB * 1024;
        if ($sizeBytes > $maxSize) {
            $snapshotData = self::compressSnapshotData($snapshotData);
            $jsonData = json_encode($snapshotData, JSON_UNESCAPED_UNICODE);
            $sizeBytes = strlen($jsonData);
        }

        $lastVersion = AlbumSnapshot::where('album_id', $albumId)
            ->max('version');
        $nextVersion = ($lastVersion ?? 0) + 1;

        $snapshot = new AlbumSnapshot();
        $snapshot->album_id = $albumId;
        $snapshot->version = $nextVersion;
        $snapshot->snapshot_data = $snapshotData;
        $snapshot->page_count = count($snapshotData['pages']);
        $snapshot->size_bytes = $sizeBytes;
        $snapshot->operator_id = $operatorId;
        $snapshot->remark = $remark ?: '';
        $snapshot->save();

        self::purgeOldVersions($albumId);

        return $snapshot;
    }

    public static function compressSnapshotData($snapshotData)
    {
        if (!empty($snapshotData['album']['description']) && strlen($snapshotData['album']['description']) > 500) {
            $snapshotData['album']['description'] = mb_substr($snapshotData['album']['description'], 0, 500) . '...';
        }
        foreach ($snapshotData['pages'] as &$page) {
            if (!empty($page['description']) && strlen($page['description']) > 500) {
                $page['description'] = mb_substr($page['description'], 0, 500) . '...';
            }
        }
        return $snapshotData;
    }

    public static function purgeOldVersions($albumId)
    {
        $maxVersions = AlbumSnapshot::MAX_VERSIONS_PER_ALBUM;
        $count = AlbumSnapshot::where('album_id', $albumId)->count();

        if ($count > $maxVersions) {
            $snapshotsToDelete = AlbumSnapshot::where('album_id', $albumId)
                ->order('version', 'asc')
                ->limit($count - $maxVersions)
                ->select();

            foreach ($snapshotsToDelete as $snapshot) {
                $snapshot->delete();
            }
        }
    }

    public static function getSnapshotList($albumId, $page = 1, $limit = 20)
    {
        self::ensureTableExists();

        $total = AlbumSnapshot::where('album_id', $albumId)->count();
        $list = AlbumSnapshot::with(['operator'])
            ->where('album_id', $albumId)
            ->order('version', 'desc')
            ->page($page, $limit)
            ->select();

        $list->each(function ($item) {
            $item->makeHidden(['snapshot_data']);
            $item->size_kb = round($item->size_bytes / 1024, 1);
            if ($item->operator) {
                $item->operator_name = $item->operator->nickname ?: $item->operator->username;
                unset($item->operator);
            } else {
                $item->operator_name = '未知用户';
            }
            return $item;
        });

        return [
            'list'  => $list,
            'total' => $total,
            'page'  => (int)$page,
            'limit' => (int)$limit,
        ];
    }

    public static function getSnapshotDetail($albumId, $snapshotId)
    {
        $snapshot = AlbumSnapshot::where('album_id', $albumId)->where('id', $snapshotId)->find();
        if (!$snapshot) {
            throw new \Exception('快照不存在');
        }

        $operator = User::find($snapshot->operator_id);
        $snapshotData = $snapshot->snapshot_data;
        $snapshotData['size_kb'] = round($snapshot->size_bytes / 1024, 1);
        $snapshotData['version'] = $snapshot->version;
        $snapshotData['created_at'] = $snapshot->created_at;
        $snapshotData['operator_name'] = $operator ? ($operator->nickname ?: $operator->username) : '未知用户';
        $snapshotData['remark'] = $snapshot->remark;

        return $snapshotData;
    }

    public static function compareSnapshots($albumId, $snapshotId1, $snapshotId2)
    {
        $snap1 = self::getSnapshotDetail($albumId, $snapshotId1);
        $snap2 = self::getSnapshotDetail($albumId, $snapshotId2);

        $albumDiff = self::diffAlbumFields($snap1['album'], $snap2['album']);
        $pagesDiff = self::diffPages($snap1['pages'], $snap2['pages']);

        return [
            'snapshot1' => [
                'id' => $snapshotId1,
                'version' => $snap1['version'],
                'created_at' => $snap1['created_at'],
                'operator_name' => $snap1['operator_name'],
            ],
            'snapshot2' => [
                'id' => $snapshotId2,
                'version' => $snap2['version'],
                'created_at' => $snap2['created_at'],
                'operator_name' => $snap2['operator_name'],
            ],
            'album_diff' => $albumDiff,
            'pages_diff' => $pagesDiff,
        ];
    }

    private static function diffAlbumFields($album1, $album2)
    {
        $fields = [
            'title' => '画册标题',
            'description' => '画册描述',
            'cover_image' => '封面图片',
            'background_image' => '背景图片',
            'category_id' => '分类',
            'min_level' => '最低访问等级',
            'share_password' => '分享密码',
            'status' => '发布状态',
            'watermark_enabled' => '水印开关',
            'watermark_text' => '水印文字',
            'watermark_opacity' => '水印透明度',
            'watermark_density' => '水印密度',
            'watermark_color' => '水印颜色',
        ];

        $diff = [];
        foreach ($fields as $key => $label) {
            $v1 = $album1[$key] ?? null;
            $v2 = $album2[$key] ?? null;
            if ($v1 !== $v2) {
                $diff[] = [
                    'field' => $key,
                    'label' => $label,
                    'old_value' => $v1,
                    'new_value' => $v2,
                ];
            }
        }
        return $diff;
    }

    private static function diffPages($pages1, $pages2)
    {
        $pages1ByNumber = [];
        foreach ($pages1 as $p) {
            $pages1ByNumber[$p['page_number']] = $p;
        }
        $pages2ByNumber = [];
        foreach ($pages2 as $p) {
            $pages2ByNumber[$p['page_number']] = $p;
        }

        $allNumbers = array_unique(array_merge(array_keys($pages1ByNumber), array_keys($pages2ByNumber)));
        sort($allNumbers);

        $added = [];
        $removed = [];
        $modified = [];

        foreach ($allNumbers as $num) {
            $p1 = $pages1ByNumber[$num] ?? null;
            $p2 = $pages2ByNumber[$num] ?? null;

            if ($p1 === null && $p2 !== null) {
                $added[] = self::formatPageDiff($p2, 'added');
            } elseif ($p1 !== null && $p2 === null) {
                $removed[] = self::formatPageDiff($p1, 'removed');
            } else {
                $fieldsDiff = [];
                $compareFields = ['image', 'title', 'description'];
                foreach ($compareFields as $f) {
                    if (($p1[$f] ?? '') !== ($p2[$f] ?? '')) {
                        $fieldsDiff[] = [
                            'field' => $f,
                            'old_value' => $p1[$f] ?? '',
                            'new_value' => $p2[$f] ?? '',
                        ];
                    }
                }
                if (!empty($fieldsDiff)) {
                    $modified[] = [
                        'page_number' => $num,
                        'old_title' => $p1['title'] ?? '',
                        'new_title' => $p2['title'] ?? '',
                        'changes' => $fieldsDiff,
                        'change_type' => 'modified',
                    ];
                }
            }
        }

        return [
            'added' => $added,
            'removed' => $removed,
            'modified' => $modified,
            'summary' => sprintf(
                '新增 %d 页，删除 %d 页，修改 %d 页',
                count($added),
                count($removed),
                count($modified)
            ),
        ];
    }

    private static function formatPageDiff($page, $type)
    {
        return [
            'page_number' => $page['page_number'],
            'title' => $page['title'] ?? '',
            'image' => $page['image'] ?? '',
            'description' => $page['description'] ?? '',
            'change_type' => $type,
        ];
    }

    public static function rollbackToSnapshot($albumId, $snapshotId, $operatorId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            throw new \Exception('画册不存在');
        }

        $targetSnapshot = AlbumSnapshot::where('album_id', $albumId)->where('id', $snapshotId)->find();
        if (!$targetSnapshot) {
            throw new \Exception('目标快照不存在');
        }

        self::createSnapshot($albumId, $operatorId, "回滚前快照");

        self::ensureTableExists();

        Db::startTrans();
        try {
            $snapshotData = $targetSnapshot->snapshot_data;
            $albumData = $snapshotData['album'];
            $pagesData = $snapshotData['pages'];

            $albumFields = [
                'title', 'description', 'cover_image', 'background_image',
                'category_id', 'min_level', 'share_password', 'qrcode_logo',
                'qrcode_image', 'qrcode_text_line1', 'qrcode_text_line2',
                'status', 'sort_order', 'watermark_enabled', 'watermark_text',
                'watermark_opacity', 'watermark_density', 'watermark_color',
            ];
            foreach ($albumFields as $f) {
                if (array_key_exists($f, $albumData)) {
                    $album->$f = $albumData[$f];
                }
            }
            $album->save();

            $currentPagesCollection = AlbumPage::where('album_id', $albumId)
                ->order('page_number', 'asc')
                ->select();
            $currentPages = [];
            foreach ($currentPagesCollection as $p) {
                $currentPages[$p->page_number] = $p;
            }

            $targetPageNumbers = array_column($pagesData, 'page_number');
            $currentPageNumbers = array_keys($currentPages);

            $numbersToDelete = array_diff($currentPageNumbers, $targetPageNumbers);
            foreach ($numbersToDelete as $num) {
                AlbumPage::where('album_id', $albumId)->where('page_number', $num)->delete();
            }

            foreach ($pagesData as $pageData) {
                $num = $pageData['page_number'];
                if (isset($currentPages[$num])) {
                    $page = $currentPages[$num];
                    $page->image = $pageData['image'];
                    $page->title = $pageData['title'] ?? '';
                    $page->description = $pageData['description'] ?? '';
                    $page->sort_order = $pageData['sort_order'] ?? 0;
                    $page->save();
                } else {
                    $newPage = new AlbumPage();
                    $newPage->album_id = $albumId;
                    $newPage->page_number = $num;
                    $newPage->image = $pageData['image'];
                    $newPage->title = $pageData['title'] ?? '';
                    $newPage->description = $pageData['description'] ?? '';
                    $newPage->sort_order = $pageData['sort_order'] ?? 0;
                    $newPage->save();
                }
            }

            $remainingPages = AlbumPage::where('album_id', $albumId)
                ->order('page_number', 'asc')
                ->select();
            $idx = 1;
            foreach ($remainingPages as $p) {
                if ($p->page_number != $idx) {
                    $p->page_number = $idx;
                    $p->save();
                }
                $idx++;
            }

            Db::commit();

            $rollbackSnapshot = self::createSnapshot(
                $albumId,
                $operatorId,
                "回滚到版本 v{$targetSnapshot->version}",
                $album,
                AlbumPage::where('album_id', $albumId)->order('page_number', 'asc')->select()
            );

            Log::info("画册回滚: Album ID {$albumId}, 回滚到快照 {$snapshotId}, 新版本 {$rollbackSnapshot->version} by user {$operatorId}");

            return [
                'success' => true,
                'new_version' => $rollbackSnapshot->version,
                'album' => $album,
            ];
        } catch (\Exception $e) {
            Db::rollback();
            throw $e;
        }
    }

    public static function checkVersionConflict($albumId, $expectedVersion)
    {
        $latestVersion = AlbumSnapshot::where('album_id', $albumId)->max('version') ?: 0;
        return $latestVersion <= $expectedVersion;
    }
}
