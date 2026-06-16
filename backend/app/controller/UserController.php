<?php

namespace app\controller;

use app\model\User;
use app\model\MemberLevel;
use think\facade\Log;
use think\facade\Validate;
use think\Request;

class UserController
{
    public function index(Request $request)
    {
        $page = $request->get('page', 1);
        $limit = $request->get('limit', 10);
        $keyword = $request->get('keyword', '');
        $role = $request->get('role', '');
        $status = $request->get('status', '');

        $query = User::with(['memberLevel']);

        if ($keyword !== '') {
            $query->where(function ($q) use ($keyword) {
                $q->where('username', 'like', "%{$keyword}%")
                  ->whereOr('nickname', 'like', "%{$keyword}%")
                  ->whereOr('email', 'like', "%{$keyword}%");
            });
        }
        if ($role !== '') {
            $query->where('role', $role);
        }
        if ($status !== '') {
            $query->where('status', $status);
        }

        $total = $query->count();
        $list = $query->order('id', 'desc')
            ->page($page, $limit)
            ->select()
            ->each(function ($item) {
                $item->avatar_url = $item->avatar ? get_upload_url($item->avatar) : '';
                return $item;
            });

        return json_success([
            'list'  => $list,
            'total' => $total,
            'page'  => (int)$page,
            'limit' => (int)$limit,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->post();

        $validate = Validate::rule([
            'username' => 'require|length:3,30|alphaDash',
            'password' => 'require|length:6,30',
        ])->message([
            'username.require'   => '用户名不能为空',
            'username.length'    => '用户名长度为3-30个字符',
            'username.alphaDash' => '用户名只能包含字母、数字、下划线和破折号',
            'password.require'   => '密码不能为空',
            'password.length'    => '密码长度为6-30个字符',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        if (!empty($data['email'])) {
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                return json_error('邮箱格式不正确');
            }
        }

        if (!empty($data['phone'])) {
            if (!preg_match('/^1[3-9]\d{9}$/', $data['phone'])) {
                return json_error('手机号格式不正确');
            }
        }

        $exists = User::where('username', $data['username'])->find();
        if ($exists) {
            return json_error('用户名已存在');
        }

        $user = new User();
        $user->username = $data['username'];
        $user->password = $data['password'];
        $user->nickname = $data['nickname'] ?? $data['username'];
        $user->email = $data['email'] ?? '';
        $user->phone = $data['phone'] ?? '';
        $user->role = $data['role'] ?? 'user';
        $user->member_level_id = $data['member_level_id'] ?? 1;
        $user->status = $data['status'] ?? 1;
        $user->save();

        Log::info("管理员创建用户: {$user->username} (ID: {$user->id})");

        return json_success($user, '用户创建成功');
    }

    public function update(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return json_error('用户不存在', 404);
        }

        $data = getRequestData($request);
        $currentUserId = $request->uid;

        if ((int)$id === 1) {
            if (isset($data['role']) && $data['role'] !== 'admin') {
                return json_error('默认管理员角色不可变更');
            }
            if (isset($data['member_level_id']) && (int)$data['member_level_id'] !== (int)$user->member_level_id) {
                return json_error('默认管理员会员等级不可变更');
            }
            if (isset($data['status']) && (int)$data['status'] !== 1) {
                return json_error('默认管理员不可禁用');
            }
        }

        if ((int)$id === (int)$currentUserId) {
            if (isset($data['role']) && $data['role'] !== $user->role) {
                return json_error('不能修改自己的角色');
            }
            if (isset($data['status']) && (int)$data['status'] === 0) {
                return json_error('不能禁用自己的账号');
            }
        }

        if (isset($data['nickname'])) {
            $user->nickname = $data['nickname'];
        }

        if (array_key_exists('email', $data)) {
            if (!empty($data['email'])) {
                if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    return json_error('邮箱格式不正确');
                }
                $emailExists = User::where('email', $data['email'])->where('id', '<>', $id)->find();
                if ($emailExists) {
                    return json_error('该邮箱已被使用');
                }
            }
            $user->email = $data['email'] ?? '';
        }

        if (array_key_exists('phone', $data)) {
            if (!empty($data['phone'])) {
                if (!preg_match('/^1[3-9]\d{9}$/', $data['phone'])) {
                    return json_error('手机号格式不正确');
                }
                $phoneExists = User::where('phone', $data['phone'])->where('id', '<>', $id)->find();
                if ($phoneExists) {
                    return json_error('该手机号已被使用');
                }
            }
            $user->phone = $data['phone'] ?? '';
        }

        if (isset($data['role']) && (int)$id !== (int)$currentUserId) {
            $user->role = $data['role'];
        }

        if (isset($data['member_level_id'])) {
            $user->member_level_id = $data['member_level_id'];
        }

        if (isset($data['status']) && (int)$id !== (int)$currentUserId) {
            $user->status = $data['status'];
        }

        if (!empty($data['password'])) {
            if (strlen($data['password']) < 6) {
                return json_error('密码长度不能少于6个字符');
            }
            $user->password = $data['password'];
        }

        $user->save();

        Log::info("管理员更新用户: {$user->username} (ID: {$user->id}) by admin {$currentUserId}");

        return json_success($user, '用户更新成功');
    }

    public function delete(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return json_error('用户不存在', 404);
        }

        if ((int)$id === (int)$request->uid) {
            return json_error('不能删除自己的账号');
        }

        if ($user->role === 'admin') {
            $adminCount = User::where('role', 'admin')->where('status', 1)->count();
            if ($adminCount <= 1) {
                return json_error('系统至少需要保留一个管理员账号');
            }
        }

        $albumCount = \app\model\Album::where('creator_id', $id)->count();
        if ($albumCount > 0) {
            return json_error("该用户创建了 {$albumCount} 个画册，无法删除");
        }

        $username = $user->username;
        $user->delete();

        Log::info("管理员删除用户: {$username} (ID: {$id}) by admin {$request->uid}");

        return json_success([], '用户删除成功');
    }

    public function detail(Request $request, $id)
    {
        $user = User::with(['memberLevel'])->find($id);
        if (!$user) {
            return json_error('用户不存在', 404);
        }

        $user->avatar_url = $user->avatar ? get_upload_url($user->avatar) : '';

        return json_success($user);
    }
}
