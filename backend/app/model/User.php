<?php

namespace app\model;

use think\Model;

class User extends Model
{
    protected $table = 'users';
    protected $pk = 'id';
    protected $autoWriteTimestamp = 'datetime';
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';

    protected $hidden = ['password'];

    protected $type = [
        'id'              => 'integer',
        'member_level_id' => 'integer',
        'status'          => 'integer',
    ];

    public function memberLevel()
    {
        return $this->belongsTo(MemberLevel::class, 'member_level_id', 'id');
    }

    public function setPasswordAttr($value): string
    {
        return password_hash($value, PASSWORD_BCRYPT);
    }

    public function verifyPassword(string $password): bool
    {
        return password_verify($password, $this->getData('password'));
    }
}
