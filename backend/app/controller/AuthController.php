<?php

namespace app\controller;

use app\model\User;
use app\model\MemberLevel;
use app\model\DailyQuota;
use think\facade\Log;
use think\facade\Validate;
use think\Request;

class AuthController
{
    public function login(Request $request)
    {
        $username = $request->post('username', '');
        $password = $request->post('password', '');

        if (empty($username) || empty($password)) {
            return json_error('用户名和密码不能为空');
        }

        $user = User::where('username', $username)->find();
        if (!$user) {
            return json_error('用户名或密码错误');
        }

        if ($user->status !== 1) {
            return json_error('账号已被禁用，请联系管理员');
        }

        if (!$user->verifyPassword($password)) {
            return json_error('用户名或密码错误');
        }

        $user->last_login_at = date('Y-m-d H:i:s');
        $user->save();

        $token = create_token([
            'uid'      => $user->id,
            'username' => $user->username,
            'role'     => $user->role,
        ]);

        $level = MemberLevel::find($user->member_level_id);
        $todayCount = DailyQuota::countToday($user->id, '');
        $dailyQuota = $level ? (int)$level->daily_quota : 0;
        $isAdmin = $user->role === 'admin';
        $isVip = $level && $level->level >= 3;

        Log::info("用户登录成功: {$user->username} (ID: {$user->id})");

        return json_success([
            'token' => $token,
            'user'  => [
                'id'           => $user->id,
                'username'     => $user->username,
                'nickname'     => $user->nickname,
                'email'        => $user->email,
                'phone'        => $user->phone,
                'avatar'       => $user->avatar ? get_upload_url($user->avatar) : '',
                'role'         => $user->role,
                'member_level' => $level ? $level->toArray() : null,
                'status'       => $user->status,
                'quota'        => [
                    'today_count'  => $todayCount,
                    'daily_quota'  => $dailyQuota,
                    'is_unlimited' => $dailyQuota == 0 || $isAdmin || $isVip,
                ],
            ],
        ], '登录成功');
    }

    public function register(Request $request)
    {
        $data = $request->post();

        $validate = Validate::rule([
            'username' => 'require|length:3,30|alphaDash',
            'password' => 'require|length:6,30',
            'nickname' => 'length:2,50',
        ])->message([
            'username.require'  => '用户名不能为空',
            'username.length'   => '用户名长度为3-30个字符',
            'username.alphaDash'=> '用户名只能包含字母、数字、下划线和破折号',
            'password.require'  => '密码不能为空',
            'password.length'   => '密码长度为6-30个字符',
            'nickname.length'   => '昵称长度为2-50个字符',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        if (!empty($data['email'])) {
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                return json_error('邮箱格式不正确');
            }
            $emailExists = User::where('email', $data['email'])->find();
            if ($emailExists) {
                return json_error('该邮箱已被注册');
            }
        }

        if (!empty($data['phone'])) {
            if (!preg_match('/^1[3-9]\d{9}$/', $data['phone'])) {
                return json_error('手机号格式不正确');
            }
            $phoneExists = User::where('phone', $data['phone'])->find();
            if ($phoneExists) {
                return json_error('该手机号已被注册');
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
        $user->role = 'user';
        $user->member_level_id = 1;
        $user->status = 1;
        $user->save();

        $token = create_token([
            'uid'      => $user->id,
            'username' => $user->username,
            'role'     => $user->role,
        ]);

        $level = MemberLevel::find($user->member_level_id);
        $todayCount = DailyQuota::countToday($user->id, '');
        $dailyQuota = $level ? (int)$level->daily_quota : 0;
        $isVip = $level && $level->level >= 3;

        Log::info("新用户注册: {$user->username} (ID: {$user->id})");

        return json_success([
            'token' => $token,
            'user'  => [
                'id'           => $user->id,
                'username'     => $user->username,
                'nickname'     => $user->nickname,
                'email'        => $user->email,
                'phone'        => $user->phone,
                'avatar'       => '',
                'role'         => $user->role,
                'member_level' => $level ? $level->toArray() : null,
                'status'       => $user->status,
                'quota'        => [
                    'today_count'  => $todayCount,
                    'daily_quota'  => $dailyQuota,
                    'is_unlimited' => $dailyQuota == 0 || $isVip,
                ],
            ],
        ], '注册成功');
    }

    public function profile(Request $request)
    {
        $user = User::find($request->uid);
        if (!$user) {
            return json_error('用户不存在', 404);
        }

        $level = MemberLevel::find($user->member_level_id);
        $todayCount = DailyQuota::countToday($user->id, '');
        $dailyQuota = $level ? (int)$level->daily_quota : 0;
        $isAdmin = $user->role === 'admin';
        $isVip = $level && $level->level >= 3;

        return json_success([
            'id'           => $user->id,
            'username'     => $user->username,
            'nickname'     => $user->nickname,
            'email'        => $user->email,
            'phone'        => $user->phone,
            'avatar'       => $user->avatar ? get_upload_url($user->avatar) : '',
            'role'         => $user->role,
            'member_level' => $level ? $level->toArray() : null,
            'status'       => $user->status,
            'created_at'   => $user->created_at,
            'quota'        => [
                'today_count'  => $todayCount,
                'daily_quota'  => $dailyQuota,
                'is_unlimited' => $dailyQuota == 0 || $isAdmin || $isVip,
            ],
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = User::find($request->uid);
        if (!$user) {
            return json_error('用户不存在', 404);
        }

        $data = getRequestData($request);

        if (!empty($data['nickname'])) {
            if (mb_strlen($data['nickname']) < 2 || mb_strlen($data['nickname']) > 50) {
                return json_error('昵称长度为2-50个字符');
            }
            $user->nickname = $data['nickname'];
        }

        if (array_key_exists('email', $data)) {
            if (!empty($data['email'])) {
                if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    return json_error('邮箱格式不正确');
                }
                $emailExists = User::where('email', $data['email'])->where('id', '<>', $user->id)->find();
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
                $phoneExists = User::where('phone', $data['phone'])->where('id', '<>', $user->id)->find();
                if ($phoneExists) {
                    return json_error('该手机号已被使用');
                }
            }
            $user->phone = $data['phone'] ?? '';
        }

        if (!empty($data['avatar'])) {
            $user->avatar = $data['avatar'];
        }

        $user->save();

        Log::info("用户更新资料: {$user->username} (ID: {$user->id})");

        $level = MemberLevel::find($user->member_level_id);
        $todayCount = DailyQuota::countToday($user->id, '');
        $dailyQuota = $level ? (int)$level->daily_quota : 0;
        $isAdmin = $user->role === 'admin';
        $isVip = $level && $level->level >= 3;

        return json_success([
            'id'           => $user->id,
            'username'     => $user->username,
            'nickname'     => $user->nickname,
            'email'        => $user->email,
            'phone'        => $user->phone,
            'avatar'       => $user->avatar ? get_upload_url($user->avatar) : '',
            'role'         => $user->role,
            'member_level' => $level ? $level->toArray() : null,
            'quota'        => [
                'today_count'  => $todayCount,
                'daily_quota'  => $dailyQuota,
                'is_unlimited' => $dailyQuota == 0 || $isAdmin || $isVip,
            ],
        ], '资料更新成功');
    }

    public function changePassword(Request $request)
    {
        $user = User::find($request->uid);
        if (!$user) {
            return json_error('用户不存在', 404);
        }

        $data = getRequestData($request);
        $oldPassword = $data['old_password'] ?? '';
        $newPassword = $data['new_password'] ?? '';

        if (empty($oldPassword) || empty($newPassword)) {
            return json_error('原密码和新密码不能为空');
        }

        if (strlen($newPassword) < 6 || strlen($newPassword) > 30) {
            return json_error('新密码长度为6-30个字符');
        }

        if (!$user->verifyPassword($oldPassword)) {
            return json_error('原密码不正确');
        }

        $user->password = $newPassword;
        $user->save();

        Log::info("用户修改密码: {$user->username} (ID: {$user->id})");

        return json_success([], '密码修改成功');
    }
}
