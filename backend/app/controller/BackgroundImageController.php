<?php

namespace app\controller;

use app\model\BackgroundImage;
use think\facade\Log;
use think\Request;

class BackgroundImageController
{
    public function index(Request $request)
    {
        $category = $request->get('category', '');

        $query = BackgroundImage::order('id', 'desc');

        if ($category !== '') {
            $query->where('category', $category);
        }

        $list = $query->select()->each(function ($item) {
            $item->url = get_upload_url($item->path);
            $item->thumb_url = $item->thumb_path ? get_upload_url($item->thumb_path) : get_upload_url($item->path);
            return $item;
        });

        return json_success($list);
    }

    public function store(Request $request)
    {
        $data = $request->post();

        if (empty($data['path'])) {
            return json_error('图片路径不能为空');
        }

        $bg = new BackgroundImage();
        $bg->name = $data['name'] ?? '背景图片';
        $bg->path = $data['path'];
        $bg->thumb_path = $data['thumb_path'] ?? '';
        $bg->category = $data['category'] ?? 'default';
        $bg->created_at = date('Y-m-d H:i:s');
        $bg->save();

        $bg->url = get_upload_url($bg->path);

        Log::info("添加背景图片: {$bg->name} (ID: {$bg->id})");

        return json_success($bg, '背景图片添加成功');
    }

    public function delete(Request $request, $id)
    {
        $bg = BackgroundImage::find($id);
        if (!$bg) {
            return json_error('背景图片不存在', 404);
        }

        $name = $bg->name;
        $bg->delete();

        Log::info("删除背景图片: {$name} (ID: {$id})");

        return json_success([], '背景图片删除成功');
    }
}
