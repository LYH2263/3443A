<?php

namespace app\model;

use think\Model;

class AlbumSnapshot extends Model
{
    protected $table = 'album_snapshots';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $type = [
        'id'          => 'integer',
        'album_id'    => 'integer',
        'version'     => 'integer',
        'page_count'  => 'integer',
        'size_bytes'  => 'integer',
        'operator_id' => 'integer',
    ];

    protected $json = ['snapshot_data'];
    protected $jsonAssoc = true;

    const MAX_VERSIONS_PER_ALBUM = 20;
    const MAX_SNAPSHOT_SIZE_KB = 512;

    public function album()
    {
        return $this->belongsTo(Album::class, 'album_id', 'id');
    }

    public function operator()
    {
        return $this->belongsTo(User::class, 'operator_id', 'id');
    }

    public static function buildSnapshotData($album, $pages)
    {
        $albumData = is_array($album) ? $album : $album->toArray();
        $pagesData = [];
        foreach ($pages as $page) {
            $pageArr = is_array($page) ? $page : $page->toArray();
            $pagesData[] = [
                'id'          => $pageArr['id'] ?? null,
                'page_number' => $pageArr['page_number'],
                'image'       => $pageArr['image'],
                'title'       => $pageArr['title'] ?? '',
                'description' => $pageArr['description'] ?? '',
                'sort_order'  => $pageArr['sort_order'] ?? 0,
            ];
        }

        $snapshot = [
            'album' => [
                'title'                => $albumData['title'],
                'description'          => $albumData['description'] ?? '',
                'cover_image'          => $albumData['cover_image'] ?? '',
                'background_image'     => $albumData['background_image'] ?? '',
                'category_id'          => $albumData['category_id'] ?? null,
                'min_level'            => $albumData['min_level'] ?? 0,
                'share_password'       => $albumData['share_password'] ?? '',
                'qrcode_logo'          => $albumData['qrcode_logo'] ?? '',
                'qrcode_image'         => $albumData['qrcode_image'] ?? '',
                'qrcode_text_line1'    => $albumData['qrcode_text_line1'] ?? '',
                'qrcode_text_line2'    => $albumData['qrcode_text_line2'] ?? '',
                'status'               => $albumData['status'] ?? 1,
                'sort_order'           => $albumData['sort_order'] ?? 0,
                'watermark_enabled'    => $albumData['watermark_enabled'] ?? 0,
                'watermark_text'       => $albumData['watermark_text'] ?? '',
                'watermark_opacity'    => $albumData['watermark_opacity'] ?? 0.15,
                'watermark_density'    => $albumData['watermark_density'] ?? 3,
                'watermark_color'      => $albumData['watermark_color'] ?? '#000000',
            ],
            'pages' => $pagesData,
            'schema_version' => 1,
        ];

        return $snapshot;
    }

    public static function getImagePathsFromSnapshot($snapshotData)
    {
        $paths = [];
        $album = $snapshotData['album'] ?? [];
        if (!empty($album['cover_image'])) $paths[] = $album['cover_image'];
        if (!empty($album['background_image'])) $paths[] = $album['background_image'];
        if (!empty($album['qrcode_logo'])) $paths[] = $album['qrcode_logo'];
        if (!empty($album['qrcode_image'])) $paths[] = $album['qrcode_image'];
        foreach (($snapshotData['pages'] ?? []) as $page) {
            if (!empty($page['image'])) $paths[] = $page['image'];
        }
        return array_unique($paths);
    }
}
