<?php

namespace app\model;

use think\Model;

class AlbumCategory extends Model
{
    protected $table = 'album_categories';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $type = [
        'id'         => 'integer',
        'sort_order' => 'integer',
        'status'     => 'integer',
    ];

    public function albums()
    {
        return $this->hasMany(Album::class, 'category_id', 'id');
    }
}
