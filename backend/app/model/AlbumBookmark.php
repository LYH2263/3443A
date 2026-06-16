<?php

namespace app\model;

use think\Model;

class AlbumBookmark extends Model
{
    protected $table = 'album_bookmarks';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = false;

    protected $type = [
        'id'          => 'integer',
        'user_id'     => 'integer',
        'album_id'    => 'integer',
        'page_number' => 'integer',
    ];

    public function album()
    {
        return $this->belongsTo(Album::class, 'album_id', 'id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
