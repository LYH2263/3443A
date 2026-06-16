<?php

namespace app\controller;

use app\model\MemberLevel;
use app\model\User;
use app\service\AuditWriter;
use think\facade\Log;
use think\facade\Validate;
use think\Request;

class MemberLevelController
{
    public function index(Request $request)
    {
        $list = MemberLevel::order('level', 'asc')->select()->each(function ($item) {
            $item->user_count = User::where('member_level_id', $item->id)->count();
            return $item;
        });

        return json_success($list);
    }

    public function store(Request $request)
    {
        $data = $request->post();

        $validate = Validate::rule([
            'name'        => 'require|length:1,50',
            'level'       => 'require|integer|egt:0',
            'daily_quota' => 'integer|egt:0',
        ])->message([
            'name.require'        => '等级名称不能为空',
            'name.length'         => '等级名称长度为1-50个字符',
            'level.require'       => '等级值不能为空',
            'level.integer'       => '等级值必须为整数',
            'level.egt'           => '等级值不能为负数',
            'daily_quota.integer' => '每日配额必须为整数',
            'daily_quota.egt'     => '每日配额不能为负数',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        $exists = MemberLevel::where('level', $data['level'])->find();
        if ($exists) {
            return json_error('该等级值已存在');
        }

        $level = new MemberLevel();
        $level->name = $data['name'];
        $level->level = $data['level'];
        $level->description = $data['description'] ?? '';
        $level->daily_quota = isset($data['daily_quota']) ? (int)$data['daily_quota'] : 0;
        $level->save();

        Log::info("创建会员等级: {$level->name} (Level: {$level->level}, Quota: {$level->daily_quota})");
        AuditWriter::logCreate('level', $level->id, $level->name, [
            'name'        => $level->name,
            'level'       => $level->level,
            'description' => $level->description,
            'daily_quota' => $level->daily_quota,
        ]);

        return json_success($level, '会员等级创建成功');
    }

    public function update(Request $request, $id)
    {
        $level = MemberLevel::find($id);
        if (!$level) {
            return json_error('会员等级不存在', 404);
        }

        $data = getRequestData($request);
        $beforeData = [
            'name'        => $level->name,
            'level'       => $level->level,
            'description' => $level->description,
            'daily_quota' => $level->daily_quota,
        ];

        if (isset($data['name'])) {
            if (empty($data['name']) || mb_strlen($data['name']) > 50) {
                return json_error('等级名称长度为1-50个字符');
            }
            $level->name = $data['name'];
        }

        if (isset($data['level'])) {
            $exists = MemberLevel::where('level', $data['level'])->where('id', '<>', $id)->find();
            if ($exists) {
                return json_error('该等级值已存在');
            }
            $level->level = $data['level'];
        }

        if (isset($data['description'])) {
            $level->description = $data['description'];
        }

        if (isset($data['daily_quota'])) {
            $quota = (int)$data['daily_quota'];
            if ($quota < 0) {
                return json_error('每日配额不能为负数');
            }
            $level->daily_quota = $quota;
        }

        $level->save();

        $afterData = [
            'name'        => $level->name,
            'level'       => $level->level,
            'description' => $level->description,
            'daily_quota' => $level->daily_quota,
        ];

        Log::info("更新会员等级: {$level->name} (ID: {$id}, Quota: {$level->daily_quota})");
        AuditWriter::logUpdate('level', $level->id, $level->name, $beforeData, $afterData);

        return json_success($level, '会员等级更新成功');
    }

    public function delete(Request $request, $id)
    {
        $level = MemberLevel::find($id);
        if (!$level) {
            return json_error('会员等级不存在', 404);
        }

        $userCount = User::where('member_level_id', $id)->count();
        if ($userCount > 0) {
            return json_error("该等级下有 {$userCount} 个用户，无法删除");
        }

        $name = $level->name;
        $beforeData = [
            'name'        => $level->name,
            'level'       => $level->level,
            'description' => $level->description,
            'daily_quota' => $level->daily_quota,
        ];
        $level->delete();

        Log::info("删除会员等级: {$name} (ID: {$id})");
        AuditWriter::logDelete('level', $id, $name, $beforeData);

        return json_success([], '会员等级删除成功');
    }
}
