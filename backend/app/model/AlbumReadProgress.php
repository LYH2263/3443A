<?php

namespace app\model;

use think\Model;

class AlbumReadProgress extends Model
{
    protected $table = 'album_read_progress';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'last_read_at';

    protected $type = [
        'id'            => 'integer',
        'user_id'       => 'integer',
        'album_id'      => 'integer',
        'current_page'  => 'integer',
        'total_pages'   => 'integer',
        'is_completed'  => 'integer',
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
