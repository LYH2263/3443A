<?php

namespace app\model;

use think\Model;

class Album extends Model
{
    protected $table = 'albums';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $type = [
        'id'          => 'integer',
        'category_id' => 'integer',
        'min_level'   => 'integer',
        'view_count'  => 'integer',
        'status'      => 'integer',
        'sort_order'  => 'integer',
        'creator_id'  => 'integer',
    ];

    public function category()
    {
        return $this->belongsTo(AlbumCategory::class, 'category_id', 'id');
    }

    public function pages()
    {
        return $this->hasMany(AlbumPage::class, 'album_id', 'id')->order('page_number', 'asc');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id', 'id');
    }
}
