<?php

namespace app\model;

use think\Model;

class AccessLog extends Model
{
    protected $table = 'access_logs';
    protected $pk = 'id';
    protected $autoWriteTimestamp = false;

    protected $type = [
        'id'       => 'integer',
        'album_id' => 'integer',
        'user_id'  => 'integer',
    ];
}
