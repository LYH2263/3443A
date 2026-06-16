<?php

namespace app\model;

use think\Model;

class BackgroundImage extends Model
{
    protected $table = 'background_images';
    protected $pk = 'id';
    protected $autoWriteTimestamp = false;

    protected $type = [
        'id' => 'integer',
    ];
}
