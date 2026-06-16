<?php

namespace app\model;

use think\Model;

class MemberLevel extends Model
{
    protected $table = 'member_levels';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $type = [
        'id'          => 'integer',
        'level'       => 'integer',
        'daily_quota' => 'integer',
    ];

    public function users()
    {
        return $this->hasMany(User::class, 'member_level_id', 'id');
    }
}
