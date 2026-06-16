<?php

namespace app\controller;

use app\model\AlbumBookmark;
use app\model\Album;
use think\facade\Validate;
use think\Request;

class BookmarkController
{
    public function index(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $bookmarks = AlbumBookmark::where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->order('page_number', 'asc')
            ->select();

        return json_success($bookmarks);
    }

    public function store(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = $request->post();

        $validate = Validate::rule([
            'page_number' => 'require|integer|>=:1',
        ])->message([
            'page_number.require' => '页码不能为空',
            'page_number.integer' => '页码必须为整数',
            'page_number.>='      => '页码必须大于等于1',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        $exists = AlbumBookmark::where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->where('page_number', $data['page_number'])
            ->find();

        if ($exists) {
            return json_error('该页已添加书签');
        }

        $bookmark = new AlbumBookmark();
        $bookmark->user_id = $request->uid;
        $bookmark->album_id = $albumId;
        $bookmark->page_number = $data['page_number'];
        $bookmark->note = $data['note'] ?? '';
        $bookmark->save();

        return json_success($bookmark, '书签添加成功');
    }

    public function delete(Request $request, $albumId, $id)
    {
        $bookmark = AlbumBookmark::where('id', $id)
            ->where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->find();

        if (!$bookmark) {
            return json_error('书签不存在', 404);
        }

        $bookmark->delete();

        return json_success([], '书签已删除');
    }

    public function toggle(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = $request->post();

        $pageNumber = $data['page_number'] ?? 0;
        if ($pageNumber < 1) {
            return json_error('页码必须大于等于1');
        }

        $exists = AlbumBookmark::where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->where('page_number', $pageNumber)
            ->find();

        if ($exists) {
            $exists->delete();
            return json_success(['bookmarked' => false], '书签已移除');
        }

        $bookmark = new AlbumBookmark();
        $bookmark->user_id = $request->uid;
        $bookmark->album_id = $albumId;
        $bookmark->page_number = $pageNumber;
        $bookmark->note = $data['note'] ?? '';
        $bookmark->save();

        return json_success(['bookmarked' => true, 'bookmark' => $bookmark], '书签添加成功');
    }

    public function allByAlbum(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $bookmarks = AlbumBookmark::where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->order('page_number', 'asc')
            ->select();

        $pageNumbers = $bookmarks->column('page_number');

        return json_success(['page_numbers' => $pageNumbers, 'bookmarks' => $bookmarks]);
    }
}
