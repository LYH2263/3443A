<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use app\model\AlbumCategory;
use app\model\AccessLog;
use app\model\MemberLevel;
use app\model\User;
use think\facade\Log;
use think\facade\Validate;
use think\Request;

class AlbumController
{
    public function index(Request $request)
    {
        $page = $request->get('page', 1);
        $limit = $request->get('limit', 12);
        $categoryId = $request->get('category_id', '');
        $keyword = $request->get('keyword', '');
        $status = $request->get('status', '');

        $query = Album::with(['category']);

        if ($categoryId !== '') {
            $query->where('category_id', $categoryId);
        }
        if ($keyword !== '') {
            $query->where('title', 'like', "%{$keyword}%");
        }
        if ($status !== '') {
            $query->where('status', $status);
        }

        $total = $query->count();
        $list = $query->order('sort_order', 'asc')
            ->order('id', 'desc')
            ->page($page, $limit)
            ->select()
            ->each(function ($item) {
                $item->cover_image_url = $item->cover_image ? get_upload_url($item->cover_image) : '';
                $item->background_image_url = $item->background_image ? get_upload_url($item->background_image) : '';
                $item->qrcode_image_url = $item->qrcode_image ? get_upload_url($item->qrcode_image) : '';
                $item->page_count = AlbumPage::where('album_id', $item->id)->count();
                return $item;
            });

        return json_success([
            'list'  => $list,
            'total' => $total,
            'page'  => (int)$page,
            'limit' => (int)$limit,
        ]);
    }

    public function publicList(Request $request)
    {
        $page = $request->get('page', 1);
        $limit = $request->get('limit', 12);
        $categoryId = $request->get('category_id', '');
        $keyword = $request->get('keyword', '');

        $userLevel = 0;
        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload) {
                $user = User::find($payload['uid'] ?? 0);
                if ($user) {
                    $level = MemberLevel::find($user->member_level_id);
                    $userLevel = $level ? $level->level : 0;
                }
            }
        }

        $query = Album::with(['category'])
            ->where('status', 1)
            ->where('min_level', '<=', $userLevel);

        if ($categoryId !== '') {
            $query->where('category_id', $categoryId);
        }
        if ($keyword !== '') {
            $query->where('title', 'like', "%{$keyword}%");
        }

        $total = $query->count();
        $list = $query->order('sort_order', 'asc')
            ->order('id', 'desc')
            ->page($page, $limit)
            ->select()
            ->each(function ($item) {
                $item->cover_image_url = $item->cover_image ? get_upload_url($item->cover_image) : '';
                $item->background_image_url = $item->background_image ? get_upload_url($item->background_image) : '';
                $item->has_password = !empty($item->share_password);
                $item->page_count = AlbumPage::where('album_id', $item->id)->count();
                unset($item->share_password);
                return $item;
            });

        return json_success([
            'list'  => $list,
            'total' => $total,
            'page'  => (int)$page,
            'limit' => (int)$limit,
        ]);
    }

    public function detail(Request $request, $id)
    {
        $album = Album::with(['category', 'pages'])->find($id);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $album->cover_image_url = $album->cover_image ? get_upload_url($album->cover_image) : '';
        $album->background_image_url = $album->background_image ? get_upload_url($album->background_image) : '';
        $album->qrcode_image_url = $album->qrcode_image ? get_upload_url($album->qrcode_image) : '';
        $album->qrcode_logo_url = $album->qrcode_logo ? get_upload_url($album->qrcode_logo) : '';

        $pages = $album->pages->each(function ($page) {
            $page->image_url = $page->image ? get_upload_url($page->image) : '';
            return $page;
        });

        return json_success($album);
    }

    public function publicDetail(Request $request, $id)
    {
        $album = Album::with(['category'])->find($id);
        if (!$album || $album->status !== 1) {
            return json_error('画册不存在或未发布', 404);
        }

        $userLevel = 0;
        $userId = null;
        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload) {
                $user = User::find($payload['uid'] ?? 0);
                if ($user) {
                    $level = MemberLevel::find($user->member_level_id);
                    $userLevel = $level ? $level->level : 0;
                    $userId = $user->id;
                    if ($user->role === 'admin') {
                        $userLevel = 999;
                    }
                }
            }
        }

        $needPassword = false;
        if ($album->min_level > $userLevel) {
            if (!empty($album->share_password)) {
                $inputPassword = $request->get('password', '') ?: $request->post('password', '');
                if ($inputPassword !== $album->share_password) {
                    $needPassword = true;
                }
            } else {
                return json_error('您的会员等级不足，无法查看此画册', 403);
            }
        }

        if ($needPassword) {
            return json_success([
                'need_password' => true,
                'album'         => [
                    'id'    => $album->id,
                    'title' => $album->title,
                    'cover_image_url' => $album->cover_image ? get_upload_url($album->cover_image) : '',
                ],
            ], '请输入分享密码');
        }

        Album::where('id', $id)->inc('view_count')->update();

        AccessLog::create([
            'album_id'   => $id,
            'user_id'    => $userId,
            'ip'         => $request->ip(),
            'user_agent' => $request->header('user-agent', ''),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $pages = AlbumPage::where('album_id', $id)
            ->order('page_number', 'asc')
            ->select()
            ->each(function ($page) {
                $page->image_url = $page->image ? get_upload_url($page->image) : '';
                return $page;
            });

        return json_success([
            'need_password' => false,
            'album' => [
                'id'                   => $album->id,
                'title'                => $album->title,
                'description'          => $album->description,
                'cover_image_url'      => $album->cover_image ? get_upload_url($album->cover_image) : '',
                'background_image_url' => $album->background_image ? get_upload_url($album->background_image) : '',
                'qrcode_image_url'     => $album->qrcode_image ? get_upload_url($album->qrcode_image) : '',
                'qrcode_text_line1'    => $album->qrcode_text_line1,
                'qrcode_text_line2'    => $album->qrcode_text_line2,
                'category'             => $album->category,
                'view_count'           => $album->view_count,
            ],
            'pages' => $pages,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->post();

        $validate = Validate::rule([
            'title' => 'require|length:1,200',
        ])->message([
            'title.require' => '画册标题不能为空',
            'title.length'  => '画册标题长度为1-200个字符',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        $album = new Album();
        $album->title = $data['title'];
        $album->description = $data['description'] ?? '';
        $album->cover_image = $data['cover_image'] ?? '';
        $album->background_image = $data['background_image'] ?? '';
        $album->category_id = $data['category_id'] ?? null;
        $album->min_level = $data['min_level'] ?? 0;
        $album->share_password = $data['share_password'] ?? '';
        $album->qrcode_logo = $data['qrcode_logo'] ?? '';
        $album->qrcode_text_line1 = $data['qrcode_text_line1'] ?? '';
        $album->qrcode_text_line2 = $data['qrcode_text_line2'] ?? '';
        $album->status = $data['status'] ?? 1;
        $album->sort_order = $data['sort_order'] ?? 0;
        $album->creator_id = $request->uid;
        $album->save();

        Log::info("创建画册: {$album->title} (ID: {$album->id}) by user {$request->uid}");

        return json_success($album, '画册创建成功');
    }

    public function update(Request $request, $id)
    {
        $album = Album::find($id);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = getRequestData($request);

        if (isset($data['title'])) {
            if (empty($data['title']) || mb_strlen($data['title']) > 200) {
                return json_error('画册标题长度为1-200个字符');
            }
            $album->title = $data['title'];
        }

        $fields = ['description', 'cover_image', 'background_image', 'category_id',
                    'min_level', 'share_password', 'qrcode_logo',
                    'qrcode_text_line1', 'qrcode_text_line2', 'status', 'sort_order'];

        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $album->$field = $data[$field];
            }
        }

        $album->save();

        Log::info("更新画册: {$album->title} (ID: {$album->id}) by user {$request->uid}");

        return json_success($album, '画册更新成功');
    }

    public function delete(Request $request, $id)
    {
        $album = Album::find($id);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $pageCount = AlbumPage::where('album_id', $id)->count();
        if ($pageCount > 0) {
            return json_error("该画册下有 {$pageCount} 个页面，请先删除页面后再删除画册");
        }

        AccessLog::where('album_id', $id)->delete();

        $title = $album->title;
        $album->delete();

        Log::info("删除画册: {$title} (ID: {$id}) by user {$request->uid}");

        return json_success([], '画册删除成功');
    }

    public function categories()
    {
        $list = AlbumCategory::where('status', 1)
            ->order('sort_order', 'asc')
            ->select();

        return json_success($list);
    }
}
