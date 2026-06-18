<?php

namespace app\model;

use think\Model;

class AuditLog extends Model
{
    protected $table = 'audit_logs';
    protected $pk = 'id';
    protected $autoWriteTimestamp = false;
    protected $createTime = false;
    protected $updateTime = false;

    protected $type = [
        'id'             => 'integer',
        'operator_id'    => 'integer',
    ];

    protected $json = ['change_summary'];
    protected $jsonAssoc = true;

    protected $append = ['action_type_text', 'target_type_text'];

    public static function actionTypes(): array
    {
        return [
            'create'  => '创建',
            'update'  => '更新',
            'delete'  => '删除',
            'login'   => '登录',
            'logout'  => '登出',
            'qrcode'  => '生成二维码',
            'snapshot'=> '快照',
            'rollback'=> '回滚',
            'other'   => '其他',
        ];
    }

    public static function targetTypes(): array
    {
        return [
            'album'    => '画册',
            'user'     => '用户',
            'category' => '分类',
            'level'    => '会员等级',
            'system'   => '系统',
        ];
    }

    public function getActionTypeTextAttr(): string
    {
        $types = self::actionTypes();
        return $types[$this->getData('action_type')] ?? $this->getData('action_type');
    }

    public function getTargetTypeTextAttr(): string
    {
        $types = self::targetTypes();
        return $types[$this->getData('target_type')] ?? $this->getData('target_type');
    }

    public function scopeByOperator($query, $operatorId)
    {
        if ($operatorId) {
            return $query->where('operator_id', $operatorId);
        }
        return $query;
    }

    public function scopeByActionType($query, $actionType)
    {
        if ($actionType) {
            return $query->where('action_type', $actionType);
        }
        return $query;
    }

    public function scopeByTargetType($query, $targetType)
    {
        if ($targetType) {
            return $query->where('target_type', $targetType);
        }
        return $query;
    }

    public function scopeByKeyword($query, $keyword)
    {
        if ($keyword) {
            return $query->where(function ($q) use ($keyword) {
                $q->where('operator_name', 'like', "%{$keyword}%")
                  ->whereOr('target_name', 'like', "%{$keyword}%");
            });
        }
        return $query;
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        if ($startDate) {
            $query = $query->where('created_at', '>=', $startDate . ' 00:00:00');
        }
        if ($endDate) {
            $query = $query->where('created_at', '<=', $endDate . ' 23:59:59');
        }
        return $query;
    }
}
