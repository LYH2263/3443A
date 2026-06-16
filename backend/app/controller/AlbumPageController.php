<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use think\facade\Log;
use think\facade\Validate;
use think\Request;

class AlbumPageController
{
    public function index(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $pages = AlbumPage::where('album_id', $albumId)
            ->order('page_number', 'asc')
            ->select()
            ->each(function ($page) {
                $page->image_url = $page->image ? get_upload_url($page->image) : '';
                return $page;
            });

        return json_success($pages);
    }

    public function store(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = $request->post();

        $validate = Validate::rule([
            'image' => 'require',
        ])->message([
            'image.require' => '页面图片不能为空',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        $maxPage = AlbumPage::where('album_id', $albumId)->max('page_number') ?? 0;

        $page = new AlbumPage();
        $page->album_id = $albumId;
        $page->page_number = $data['page_number'] ?? ($maxPage + 1);
        $page->image = $data['image'];
        $page->title = $data['title'] ?? '';
        $page->description = $data['description'] ?? '';
        $page->sort_order = $data['sort_order'] ?? 0;
        $page->save();

        $page->image_url = get_upload_url($page->image);

        Log::info("添加画册页面: Album ID {$albumId}, Page {$page->page_number} by user {$request->uid}");

        return json_success($page, '页面添加成功');
    }

    public function update(Request $request, $albumId, $id)
    {
        $page = AlbumPage::where('album_id', $albumId)->where('id', $id)->find();
        if (!$page) {
            return json_error('页面不存在', 404);
        }

        $data = getRequestData($request);

        $fields = ['page_number', 'image', 'title', 'description', 'sort_order'];
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $page->$field = $data[$field];
            }
        }

        $page->save();
        $page->image_url = get_upload_url($page->image);

        Log::info("更新画册页面: Album ID {$albumId}, Page ID {$id} by user {$request->uid}");

        return json_success($page, '页面更新成功');
    }

    public function delete(Request $request, $albumId, $id)
    {
        $page = AlbumPage::where('album_id', $albumId)->where('id', $id)->find();
        if (!$page) {
            return json_error('页面不存在', 404);
        }

        $pageNumber = $page->page_number;
        $page->delete();

        AlbumPage::where('album_id', $albumId)
            ->where('page_number', '>', $pageNumber)
            ->dec('page_number')
            ->update();

        Log::info("删除画册页面: Album ID {$albumId}, Page ID {$id} by user {$request->uid}");

        return json_success([], '页面删除成功');
    }

    public function sort(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $pages = $request->post('pages', []);
        if (empty($pages)) {
            return json_error('排序数据不能为空');
        }

        foreach ($pages as $index => $pageData) {
            AlbumPage::where('id', $pageData['id'])
                ->where('album_id', $albumId)
                ->update([
                    'page_number' => $index + 1,
                    'sort_order'  => $index,
                ]);
        }

        Log::info("排序画册页面: Album ID {$albumId} by user {$request->uid}");

        return json_success([], '排序更新成功');
    }
}
