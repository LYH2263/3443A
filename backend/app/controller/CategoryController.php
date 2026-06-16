<?php

namespace app\controller;

use app\model\AlbumCategory;
use app\model\Album;
use think\facade\Log;
use think\facade\Validate;
use think\Request;

class CategoryController
{
    public function index(Request $request)
    {
        $list = AlbumCategory::order('sort_order', 'asc')
            ->select()
            ->each(function ($item) {
                $item->album_count = Album::where('category_id', $item->id)->count();
                return $item;
            });

        return json_success($list);
    }

    public function store(Request $request)
    {
        $data = $request->post();

        $validate = Validate::rule([
            'name' => 'require|length:1,100',
        ])->message([
            'name.require' => '分类名称不能为空',
            'name.length'  => '分类名称长度为1-100个字符',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        $exists = AlbumCategory::where('name', $data['name'])->find();
        if ($exists) {
            return json_error('分类名称已存在');
        }

        $category = new AlbumCategory();
        $category->name = $data['name'];
        $category->sort_order = $data['sort_order'] ?? 0;
        $category->status = $data['status'] ?? 1;
        $category->save();

        Log::info("创建画册分类: {$category->name} (ID: {$category->id})");

        return json_success($category, '分类创建成功');
    }

    public function update(Request $request, $id)
    {
        $category = AlbumCategory::find($id);
        if (!$category) {
            return json_error('分类不存在', 404);
        }

        $data = getRequestData($request);

        if (isset($data['name'])) {
            if (empty($data['name']) || mb_strlen($data['name']) > 100) {
                return json_error('分类名称长度为1-100个字符');
            }
            $nameExists = AlbumCategory::where('name', $data['name'])->where('id', '<>', $id)->find();
            if ($nameExists) {
                return json_error('分类名称已存在');
            }
            $category->name = $data['name'];
        }

        if (isset($data['sort_order'])) {
            $category->sort_order = $data['sort_order'];
        }
        if (isset($data['status'])) {
            $category->status = $data['status'];
        }

        $category->save();

        Log::info("更新画册分类: {$category->name} (ID: {$id})");

        return json_success($category, '分类更新成功');
    }

    public function delete(Request $request, $id)
    {
        $category = AlbumCategory::find($id);
        if (!$category) {
            return json_error('分类不存在', 404);
        }

        $albumCount = Album::where('category_id', $id)->count();
        if ($albumCount > 0) {
            return json_error("该分类下有 {$albumCount} 个画册，无法删除");
        }

        $name = $category->name;
        $category->delete();

        Log::info("删除画册分类: {$name} (ID: {$id})");

        return json_success([], '分类删除成功');
    }
}
