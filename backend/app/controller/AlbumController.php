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
        $user = null;
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

        $ipSuffix = $this->getIpSuffix($request->ip());
        $viewerName = $userId ? ($user->nickname ?: $user->username) : '';

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
                'watermark' => [
                    'enabled' => (bool)$album->watermark_enabled,
                    'text'    => $album->watermark_text,
                    'opacity' => (float)$album->watermark_opacity,
                    'density' => (int)$album->watermark_density,
                    'color'   => $album->watermark_color,
                ],
            ],
            'viewer' => [
                'username'  => $viewerName,
                'is_guest'  => !$userId,
                'ip_suffix' => $ipSuffix,
                'date'      => date('Y-m-d'),
            ],
            'pages' => $pages,
        ]);
    }

    private function getIpSuffix($ip)
    {
        if (strpos($ip, ':') !== false) {
            $parts = explode(':', $ip);
            $count = count($parts);
            return $count >= 2 ? implode(':', array_slice($parts, -2)) : $ip;
        }
        $parts = explode('.', $ip);
        if (count($parts) === 4) {
            return $parts[2] . '.' . $parts[3];
        }
        return '';
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
        $album->watermark_enabled = $data['watermark_enabled'] ?? 0;
        $album->watermark_text = $data['watermark_text'] ?? '';
        $album->watermark_opacity = $data['watermark_opacity'] ?? 0.15;
        $album->watermark_density = $data['watermark_density'] ?? 3;
        $album->watermark_color = $data['watermark_color'] ?? '#000000';
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
                    'qrcode_text_line1', 'qrcode_text_line2', 'status', 'sort_order',
                    'watermark_enabled', 'watermark_text', 'watermark_opacity',
                    'watermark_density', 'watermark_color'];

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

    public function watermarkPreview(Request $request)
    {
        $text = $request->get('text', '');
        $opacity = (float)($request->get('opacity', 0.15));
        $density = (int)($request->get('density', 3));
        $color = $request->get('color', '#000000');
        $width = (int)($request->get('width', 400));
        $height = (int)($request->get('height', 300));

        if ($opacity < 0) $opacity = 0;
        if ($opacity > 1) $opacity = 1;
        if ($density < 1) $density = 1;
        if ($density > 5) $density = 5;
        if ($width < 100) $width = 100;
        if ($width > 1200) $width = 1200;
        if ($height < 100) $height = 100;
        if ($height > 900) $height = 900;

        $image = imagecreatetruecolor($width, $height);
        $bgColor = imagecolorallocate($image, 240, 240, 245);
        imagefill($image, 0, 0, $bgColor);

        $sampleText = $text ?: '示例水印文字';
        $fontSize = 14;
        $angle = -25;

        $rgb = $this->hexToRgb($color);
        $alpha = (int)((1 - $opacity) * 127);
        if ($alpha < 0) $alpha = 0;
        if ($alpha > 127) $alpha = 127;

        $watermarkColor = imagecolorallocatealpha($image, $rgb['r'], $rgb['g'], $rgb['b'], $alpha);

        $fontPath = $this->getFontPath();

        $spacingX = (int)(200 / $density);
        $spacingY = (int)(120 / $density);

        $diagonal = sqrt($width * $width + $height * $height);
        $startX = (int)(-$diagonal / 2);
        $endX = (int)($diagonal / 2 + $spacingX);
        $startY = (int)(-$diagonal / 2);
        $endY = (int)($diagonal / 2 + $spacingY);

        for ($y = $startY; $y < $endY; $y += $spacingY) {
            for ($x = $startX; $x < $endX; $x += $spacingX) {
                if ($fontPath) {
                    imagettftext($image, $fontSize, $angle, $x, $y, $watermarkColor, $fontPath, $sampleText);
                } else {
                    $this->imagestringrotated($image, $fontSize, $x, $y, $sampleText, $watermarkColor, $angle);
                }
            }
        }

        header('Content-Type: image/png');
        imagepng($image);
        imagedestroy($image);
        exit;
    }

    private function hexToRgb($hex)
    {
        $hex = str_replace('#', '', $hex);
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        return [
            'r' => hexdec(substr($hex, 0, 2)),
            'g' => hexdec(substr($hex, 2, 2)),
            'b' => hexdec(substr($hex, 4, 2)),
        ];
    }

    private function getFontPath()
    {
        $commonPaths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            '/System/Library/Fonts/PingFang.ttc',
            'C:/Windows/Fonts/msyh.ttc',
            'C:/Windows/Fonts/simhei.ttf',
        ];
        foreach ($commonPaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }
        return null;
    }

    private function imagestringrotated($image, $size, $x, $y, $text, $color, $angle)
    {
        $angle = deg2rad($angle);
        $len = strlen($text);
        for ($i = 0; $i < $len; $i++) {
            $char = $text[$i];
            $charWidth = imagefontwidth($size);
            $charHeight = imagefontheight($size);
            $dx = $i * $charWidth;
            $rotX = $x + $dx * cos($angle);
            $rotY = $y + $dx * sin($angle);
            imagestring($image, $size, (int)$rotX, (int)$rotY, $char, $color);
        }
    }
}
