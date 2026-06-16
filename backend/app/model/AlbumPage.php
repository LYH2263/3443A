<?php

namespace app\model;

use think\Model;

class AlbumPage extends Model
{
    protected $table = 'album_pages';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $type = [
        'id'          => 'integer',
        'album_id'    => 'integer',
        'page_number' => 'integer',
        'sort_order'  => 'integer',
    ];

    public function album()
    {
        return $this->belongsTo(Album::class, 'album_id', 'id');
    }
}
